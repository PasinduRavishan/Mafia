"""
test_game.py — Automated end-to-end game driver.

Drives a full game automatically, showing every log line in real time:
  - Night phase narration (who opens/closes their eyes)
  - Narrator announcements
  - Every NPC day statement in full
  - The human's prompt context (what the detective investigated, what the medic sees, etc.)
  - Individual votes from every player
  - Death announcements and role reveals
  - Win condition

Usage:
    source .venv/bin/activate
    python scripts/test_game.py          # 1 game
    python scripts/test_game.py 3        # 3 games back-to-back
"""
import random
import sys
import time
import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:8000"

# ── HTTP helpers ─────────────────────────────────────────────────────────────

def post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=30) as resp:
        return json.loads(resp.read())


# ── Auto-response logic ───────────────────────────────────────────────────────

def auto_respond(prompt: dict) -> str:
    """Pick a random valid response for any prompt type."""
    options = prompt.get("options") or []
    ptype = prompt.get("type", "")

    if ptype == "night_action" and options:
        return random.choice(options)
    elif ptype == "day_statement":
        statements = [
            "I've been watching everyone closely and something doesn't feel right.",
            "We need to think carefully — the Mafia is counting on us to make mistakes.",
            "I don't have solid evidence yet, but I'm keeping my eyes open.",
            "Let's look at who's been deflecting and staying quiet — that's usually the tell.",
            "I'm suspicious but I'd rather hear from others before committing to a name.",
        ]
        return random.choice(statements)
    elif ptype == "vote" and options:
        return random.choice(options)
    return options[0] if options else "skip"


# ── Display helpers ───────────────────────────────────────────────────────────

SEP  = "=" * 65
SEP2 = "-" * 65

PHASE_LABELS = {
    "night": "NIGHT PHASE",
    "day":   "DAY PHASE — DISCUSSION",
    "vote":  "DAY PHASE — VOTE",
    "ended": "GAME ENDED",
}

ROLE_ICONS = {
    "mafia":     "🔴 MAFIA",
    "detective": "🔵 DETECTIVE",
    "medic":     "🟢 MEDIC",
    "villager":  "⚪ VILLAGER",
}

def print_phase_header(phase: str, round_number: int) -> None:
    label = PHASE_LABELS.get(phase, phase.upper())
    print(f"\n{SEP}")
    print(f"  Round {round_number} — {label}")
    print(SEP)


def print_log_lines(lines: list[str]) -> None:
    """Print all log lines, skipping internal markers."""
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("__"):
            continue
        print(stripped)


def print_prompt(prompt: dict, state: dict) -> None:
    """Display the interrupt prompt the human received — this is the night/day context."""
    ptype = prompt.get("type", "")
    msg   = prompt.get("message", "")
    opts  = prompt.get("options") or []

    print(f"\n{SEP2}")
    if ptype == "night_action":
        print("  *** YOUR NIGHT ACTION ***")
    elif ptype == "day_statement":
        print("  *** YOUR TURN TO SPEAK ***")
    elif ptype == "vote":
        print("  *** CAST YOUR VOTE ***")
    print(SEP2)

    # Print the prompt message — contains role context, ledger, alive players etc.
    for line in msg.split("\n"):
        if line.strip():
            print(f"  {line.strip()}")

    if opts:
        print(f"\n  Available choices: {', '.join(opts)}")
    print(SEP2)


# ── Main game loop ────────────────────────────────────────────────────────────

def run_game(num_players: int = 6) -> None:
    print(f"\n{SEP}")
    print(f"  Starting new game ({num_players} players)")
    print(SEP)

    # ── Start game ──────────────────────────────────────────────────────────
    state = post("/game/start", {"num_players": num_players})
    game_id      = state["game_id"]
    your_role    = state["your_role"]
    alive        = state["alive_players"]
    role_icon    = ROLE_ICONS.get(your_role, your_role.upper())

    print(f"\n  Game ID : {game_id}")
    print(f"  Players : {', '.join(alive)}")
    print(f"\n  *** YOUR ROLE: {role_icon} ***")

    # Show role-specific private info if available
    if state.get("mafia_teammates"):
        print(f"  Your Mafia teammates: {', '.join(state['mafia_teammates'])}")
    if state.get("investigation_ledger") is not None:
        print(f"  Your investigation ledger: {state['investigation_ledger'] or 'empty'}")
    if state.get("medic_self_heal_used") is not None:
        print(f"  Self-heal used: {state['medic_self_heal_used']}")

    # ── Game state tracking ──────────────────────────────────────────────────
    seen_log_count = 0   # Index into public_log — track what we've already printed
    last_round     = 0
    last_phase     = ""
    action_count   = 0
    max_actions    = 100

    # Show any log lines returned on game start
    init_log = state.get("public_log", [])
    seen_log_count = len(init_log)
    print()
    print_log_lines(init_log)

    # ── Main loop ────────────────────────────────────────────────────────────
    while not state["game_over"] and action_count < max_actions:

        current_round = state.get("round_number", 1)
        current_phase = state.get("phase", "")

        # Print phase header whenever round or phase changes
        if current_round != last_round or current_phase != last_phase:
            print_phase_header(current_phase, current_round)
            last_round  = current_round
            last_phase  = current_phase

        prompt = state.get("prompt")

        if prompt:
            # ── Human action required ────────────────────────────────────────
            # Show the prompt context (night role instructions, day context, etc.)
            print_prompt(prompt, state)

            action_count += 1
            response = auto_respond(prompt)
            ptype = prompt["type"]

            print(f"\n  [YOU → {ptype.upper()}]: '{response}'")

            try:
                state = post(f"/game/{game_id}/action", {
                    "type": ptype,
                    "value": response,
                })
            except urllib.error.HTTPError as e:
                body = json.loads(e.read())
                print(f"\n  !! ERROR {e.code}: {body.get('detail')}")
                break

        else:
            # No prompt — graph may still be processing (NPC turns, LLM calls)
            time.sleep(0.5)
            state = get(f"/game/{game_id}/state")

        # ── Print ALL new log lines since last check ─────────────────────────
        full_log  = state.get("public_log", [])
        new_lines = full_log[seen_log_count:]
        seen_log_count = len(full_log)

        if new_lines:
            print()
            print_log_lines(new_lines)

        # ── Show updated alive/dead whenever someone dies ────────────────────
        alive_now = state.get("alive_players", [])
        dead_now  = state.get("dead_players", [])
        if dead_now:
            print(f"\n  Alive : {', '.join(alive_now)}")
            print(f"  Dead  : {', '.join(dead_now)}")

    # ── Game over summary ────────────────────────────────────────────────────
    print(f"\n{SEP}")
    if state["game_over"]:
        winner = state.get("winner") or "draw"
        print(f"  GAME OVER — {winner.upper()} WINS")
        print(f"  Alive : {state['alive_players']}")
        print(f"  Dead  : {state['dead_players']}")
    else:
        print("  GAME ENDED — max actions reached (possible hang)")
    print(f"  Total human actions: {action_count}")
    print(SEP)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Verify server is up
    try:
        get("/health")
    except Exception:
        print("\nERROR: Server not running. Start it first:")
        print("  uvicorn api.main:app --reload\n")
        sys.exit(1)

    num_games = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    for i in range(num_games):
        print(f"\n>>> Game {i + 1} of {num_games}")
        run_game(num_players=6)
