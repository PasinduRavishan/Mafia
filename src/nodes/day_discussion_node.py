"""
day_discussion_node.py — All living players discuss who the Mafia might be.
Full LLM implementation in Phase 5.
This stub skips NPC discussion but still interrupts for the human's statement.
"""
from langgraph.types import interrupt

from src.state import GameState
from src.utils.state_views import build_agent_view


def day_discussion_node(state: GameState) -> dict:
    if state["discussion_turns_left"] <= 0:
        return {"phase": "vote"}

    # If human is alive, ask for their statement
    if "human" in state["alive_player_ids"]:
        view = build_agent_view("human", state)
        statement = interrupt({
            "type": "day_statement",
            "message": (
                f"It's day {state['round_number']}. The village must find the Mafia.\n"
                f"Alive players: {', '.join(state['alive_player_ids'])}\n"
                "What do you say to the village? (2-4 sentences)"
            ),
            "options": None,  # Free text
        })

        return {
            "phase": "vote",
            "day_statements": [{"player_id": "human", "statement": statement}],
            "public_log": [f"[You]: {statement}"],
            "discussion_turns_left": state["discussion_turns_left"] - 1,
        }

    return {"phase": "vote"}
