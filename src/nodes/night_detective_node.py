"""
night_detective_node.py — Detective investigates one player and learns their alignment.

The result (Mafia / Innocent) is stored in detective_ledger — PRIVATE to the detective.
It is NEVER added to public_log. Only the detective's filtered view contains the ledger.

Same interrupt pattern as night_mafia_node:
- Human detective → interrupt() → resume with their chosen target
- NPC detective → LLM call → parse JSON
"""
from langgraph.types import interrupt

from src.agents.base_agent import call_agent, parse_json_response
from src.state import GameState, NightActions
from src.utils.prompts import DETECTIVE_NIGHT_PROMPT
from src.utils.state_views import build_agent_view


def night_detective_node(state: GameState) -> dict:
    # Find the detective (if alive)
    detective_id = next(
        (pid for pid, p in state["all_players"].items()
         if p["role"] == "detective" and p["is_alive"]),
        None
    )

    if detective_id is None:
        return {}  # No detective in this game or detective is dead

    player = state["all_players"][detective_id]

    # Valid targets: alive players except themselves
    valid_targets = [
        pid for pid in state["alive_player_ids"]
        if pid != detective_id
    ]

    if player["is_human"]:
        # ── HUMAN DETECTIVE ──
        ledger = state["detective_ledger"]
        already_investigated = list(ledger.keys())
        view = build_agent_view(detective_id, state)
        target = interrupt({
            "type": "night_action",
            "message": (
                "You are the DETECTIVE. Choose one player to investigate. "
                "You will learn if they are Mafia or Innocent.\n"
                f"Already investigated: {already_investigated or 'none'}\n"
                f"Your ledger: {ledger or 'empty'}"
            ),
            "options": valid_targets,
        })
    else:
        # ── NPC DETECTIVE ──
        view = build_agent_view(detective_id, state)
        prompt = DETECTIVE_NIGHT_PROMPT.format(
            your_player_id=view["your_player_id"],
            round_number=view["round_number"],
            alive_players=view["alive_players"],
            investigation_ledger=view.get("investigation_ledger", {}),
            public_log="\n".join(view["public_log"][-10:]),
        )
        response = call_agent(prompt, view)
        result = parse_json_response(response)
        target = result.get("target", "")

    # Validate target
    if target not in valid_targets:
        import random
        target = random.choice(valid_targets) if valid_targets else None

    # Update detective's private ledger with the TRUE alignment
    # (This is pure game logic — no LLM needed)
    updated_ledger = dict(state["detective_ledger"])
    if target and target in state["all_players"]:
        updated_ledger[target] = state["all_players"][target]["alignment"]

    night_actions = dict(state["night_actions"])
    night_actions["detective_target"] = target

    return {
        "night_actions": NightActions(**night_actions),
        "detective_ledger": updated_ledger,
    }
