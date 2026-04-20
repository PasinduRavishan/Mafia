"""
setup_node.py — Initialises GameState at the start of each new game.

This node runs ONCE at the very beginning (START → setup → night_mafia).
It receives the initial state passed from the API and ensures all fields
are properly set before the game loop begins.
"""
from src.state import GameState


def setup_node(state: GameState) -> dict:
    """
    Validates and finalises initial state.
    The API already built the full initial GameState — this node
    adds the setup announcement to the public log and sets phase to night.
    """
    player_list = ", ".join(state["alive_player_ids"])
    role_counts = {}
    for p in state["all_players"].values():
        role_counts[p["role"]] = role_counts.get(p["role"], 0) + 1

    role_summary = " | ".join(f"{count} {role}" for role, count in role_counts.items())

    return {
        "phase": "night",
        "public_log": [
            f"=== ROUND {state['round_number']} BEGINS ===",
            f"Players: {player_list}",
            f"Roles in play: {role_summary} (you don't know who has which role)",
            "Night falls. The village closes its eyes...",
        ],
    }
