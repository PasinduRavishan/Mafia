"""
state_views.py — Information isolation layer.

build_agent_view() is the ONLY way any agent (LLM or human) should receive game state.
It filters GameState down to exactly what a player's role is entitled to see.
"""
from src.state import GameState, PlayerID


def build_agent_view(player_id: PlayerID, state: GameState) -> dict:
    """
    Returns a filtered view of game state safe to show to the specified player.
    Works identically for human and LLM players — both see only their role's info.
    """
    player = state["all_players"][player_id]
    role = player["role"]

    base_view = {
        "your_player_id": player_id,
        "your_role": role,
        "your_personality": player["personality"],
        "is_human": player["is_human"],
        "round_number": state["round_number"],
        "alive_players": state["alive_player_ids"],
        "public_log": state["public_log"],
        "day_statements": state["day_statements"],
    }

    if role == "mafia":
        mafia_ids = [
            pid for pid, p in state["all_players"].items()
            if p["alignment"] == "mafia" and pid != player_id
        ]
        base_view["mafia_teammates"] = mafia_ids

    elif role == "detective":
        base_view["investigation_ledger"] = state["detective_ledger"]

    elif role == "medic":
        base_view["medic_self_heal_used"] = state["medic_self_heal_used"]

    # villager: base_view only — no private knowledge

    return base_view
