"""
vote_node.py — All living players vote to eliminate someone.
Full NPC LLM implementation in Phase 5.
This stub handles the human vote via interrupt and picks random NPC votes.
"""
import random

from langgraph.types import interrupt

from src.engine import tally_votes
from src.state import GameState
from src.utils.state_views import build_agent_view


def vote_node(state: GameState) -> dict:
    votes = {}
    vote_options = [pid for pid in state["alive_player_ids"] if pid != "human"]

    # --- Human vote ---
    if "human" in state["alive_player_ids"]:
        view = build_agent_view("human", state)
        vote = interrupt({
            "type": "vote",
            "message": (
                "Vote time! Who do you think is Mafia? Choose one player to eliminate.\n"
                f"Alive players (excluding yourself): {', '.join(vote_options)}"
            ),
            "options": vote_options,
        })
        votes["human"] = vote

    # --- NPC votes (random stub — real LLM voting in Phase 5) ---
    for pid in state["alive_player_ids"]:
        if pid == "human":
            continue
        npc_vote_options = [p for p in state["alive_player_ids"] if p != pid]
        if npc_vote_options:
            votes[pid] = random.choice(npc_vote_options)

    # Tally votes
    eliminated = tally_votes(votes)

    updates: dict = {
        "votes": votes,
        "vote_result": eliminated,
        "phase": "vote",
    }

    if eliminated:
        new_alive = [pid for pid in state["alive_player_ids"] if pid != eliminated]
        eliminated_role = state["all_players"][eliminated]["role"]
        updates["alive_player_ids"] = new_alive
        updates["dead_player_ids"] = [eliminated]
        updates["public_log"] = [
            f"[Vote]: The village voted to eliminate {eliminated}.",
            f"[Vote]: {eliminated} was a {eliminated_role}.",
        ]
    else:
        updates["public_log"] = ["[Vote]: The vote was tied. No one was eliminated."]

    return updates
