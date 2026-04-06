"""
narrator_node.py — LLM generates a story-flavored announcement of night events.
Full implementation in Phase 5. This stub parses the night result and adds
a placeholder announcement so the game log stays readable.
"""
from src.state import GameState


def narrator_node(state: GameState) -> dict:
    # Find the night result marker written by resolve_night_node
    night_result_line = next(
        (line for line in state["public_log"] if line.startswith("__night_result__")),
        None,
    )

    if night_result_line and "death:" in night_result_line:
        parts = night_result_line.split(":")
        dead_player = parts[2] if len(parts) > 2 else "someone"
        dead_role = parts[3] if len(parts) > 3 else "unknown"
        announcement = (
            f"Dawn breaks over the village. {dead_player} was found dead. "
            f"They were a {dead_role}."
        )
    else:
        announcement = (
            "Dawn breaks quietly. The village woke unharmed — "
            "whatever danger lurked in the night has passed."
        )

    return {
        "phase": "day",
        "public_log": [f"[Narrator]: {announcement}"],
    }
