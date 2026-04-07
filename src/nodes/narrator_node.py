"""
narrator_node.py — LLM generates a dramatic story announcement of night events.

Reads the __night_result__ marker left by resolve_night_node,
calls Claude to write a dramatic announcement, and appends it to public_log.
This is the only output players see from the night phase.
"""
from src.agents.base_agent import call_agent
from src.state import GameState
from src.utils.prompts import NARRATOR_PROMPT


def narrator_node(state: GameState) -> dict:
    # Find the LATEST internal night result marker from resolve_night_node
    night_result_line = next(
        (line for line in reversed(state["public_log"]) if line.startswith("__night_result__")),
        "__night_result__:no_death",
    )

    dead_player = None
    dead_role = None

    if "death:" in night_result_line:
        parts = night_result_line.split(":")
        dead_player = parts[2] if len(parts) > 2 else "someone"
        dead_role = parts[3] if len(parts) > 3 else "unknown"
        night_result = f"death:{dead_player}"
    else:
        night_result = "no_death"

    prompt = NARRATOR_PROMPT.format(
        round_number=state["round_number"],
        night_result=night_result,
        dead_player_role=dead_role or "N/A",
        reveal_role_on_death=True,
    )

    announcement = call_agent(prompt, {})

    return {
        "phase": "day",
        "public_log": [f"\n[Narrator — Round {state['round_number']}]: {announcement}\n"],
    }
