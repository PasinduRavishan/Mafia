"""
vote_node.py — All living players cast their vote to eliminate a suspect.

NPC votes run FIRST (via LLM), then human votes LAST.
This means:
  - When human sees the vote prompt, all NPC votes are already in public_log
  - Frontend can show a sequential vote ceremony with real NPC votes
  - Human always votes with full information (most dramatic)
"""
import random

from langgraph.types import interrupt

from src.agents.base_agent import call_agent, parse_json_response
from src.engine import tally_votes
from src.state import GameState
from src.utils.prompts import VOTE_PROMPT
from src.utils.state_views import build_agent_view


def _role_hint(player_id: str, state: GameState) -> str:
    role = state["all_players"][player_id]["role"]
    if role == "mafia":
        teammates = [
            pid for pid, p in state["all_players"].items()
            if p["alignment"] == "mafia" and pid != player_id
        ]
        return f"You are Mafia. Do NOT vote for your teammate(s): {teammates}. Vote for an innocent."
    elif role == "detective":
        ledger = state["detective_ledger"]
        confirmed_mafia = [pid for pid, alignment in ledger.items() if alignment == "mafia"]
        if confirmed_mafia:
            return f"Your ledger shows confirmed Mafia members: {confirmed_mafia}. Vote for one of them."
        return "Your ledger has no confirmed Mafia yet. Use the day statements to decide."
    else:
        return "Use the day statements and public log to pick who you think is most likely Mafia."


def vote_node(state: GameState) -> dict:
    votes = {}
    vote_log_lines = ["\n--- Votes cast ---"]

    # ── Step 1: NPC votes via LLM (runs BEFORE human interrupt) ─────
    for pid in state["alive_player_ids"]:
        if pid == "human":
            continue

        view = build_agent_view(pid, state)
        npc_vote_options = [p for p in state["alive_player_ids"] if p != pid]

        prompt = VOTE_PROMPT.format(
            your_player_id=view["your_player_id"],
            your_role=view["your_role"],
            vote_options=", ".join(npc_vote_options),
            public_log="\n".join(view["public_log"][-15:]),
            day_statements="\n".join(
                f"{s['player_id']}: {s['statement']}"
                for s in state["day_statements"]
            ),
            role_hint=_role_hint(pid, state),
        )

        try:
            response = call_agent(prompt, view)
            result   = parse_json_response(response)
            vote_target = result.get("vote", "")
            if vote_target in npc_vote_options:
                votes[pid] = vote_target
            else:
                votes[pid] = random.choice(npc_vote_options)
        except Exception:
            votes[pid] = random.choice(npc_vote_options)

        # Log immediately so frontend sees it when human is interrupted
        vote_log_lines.append(f"  {pid} votes for {votes[pid]}")

    # ── Step 2: Human vote via interrupt ─────────────────────────────
    # At this point all NPC votes are in vote_log_lines (returned via public_log)
    if "human" in state["alive_player_ids"]:
        all_options = [pid for pid in state["alive_player_ids"] if pid != "human"]

        # Count NPC votes so far (for display in the interrupt message)
        npc_tally: dict[str, int] = {}
        for target in votes.values():
            npc_tally[target] = npc_tally.get(target, 0) + 1
        tally_str = ", ".join(f"{p}: {c} vote{'s' if c > 1 else ''}" for p, c in
                              sorted(npc_tally.items(), key=lambda x: -x[1]))

        human_vote = interrupt({
            "type": "vote",
            "message": (
                f"=== Vote Phase — Round {state['round_number']} ===\n"
                f"The village must eliminate one player.\n"
                f"Alive players: {', '.join(state['alive_player_ids'])}\n\n"
                f"NPC votes so far:\n{tally_str or 'None yet'}\n\n"
                "Who do you vote to eliminate?"
            ),
            "options": all_options,
            "npc_votes": votes,  # Pass NPC votes directly so frontend can show them before human votes
        })

        if human_vote in all_options:
            votes["human"] = human_vote
        else:
            votes["human"] = random.choice(all_options)

        vote_log_lines.append(f"  You vote for {votes['human']}")

    # ── Step 3: Tally all votes ───────────────────────────────────────
    eliminated = tally_votes(votes)

    updates: dict = {
        "votes": votes,
        "vote_result": eliminated,
        "public_log": vote_log_lines,
    }

    if eliminated:
        new_alive = [pid for pid in state["alive_player_ids"] if pid != eliminated]
        eliminated_role = state["all_players"][eliminated]["role"]
        updated_players = dict(state["all_players"])
        updated_players[eliminated] = {**updated_players[eliminated], "is_alive": False}
        updates["all_players"] = updated_players
        updates["alive_player_ids"] = new_alive
        updates["dead_player_ids"] = [eliminated]
        updates["public_log"] = vote_log_lines + [
            f"\n[Vote Result]: The village has spoken — {eliminated} is eliminated.",
            f"[Vote Result]: {eliminated} was a {eliminated_role}.",
        ]
    else:
        updates["public_log"] = vote_log_lines + [
            "\n[Vote Result]: The vote is tied. No one is eliminated.",
            "[Vote Result]: The Mafia breathes a quiet sigh of relief...",
        ]

    return updates
