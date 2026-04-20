"""
resolve_night_node.py — Pure Python night resolution. Zero LLM calls.

Compares mafia_target vs medic_save:
- If they match → cross-save → no death
- If they don't match → mafia_target dies
- If no mafia_target → no death

Updates alive/dead player lists and appends result to public_log
so the narrator_node knows what to announce.
"""
from src.engine import resolve_night_actions
from src.state import GameState, NightActions


def resolve_night_node(state: GameState) -> dict:
    death = resolve_night_actions(state["night_actions"])

    updates: dict = {}

    if death:
        new_alive = [pid for pid in state["alive_player_ids"] if pid != death]
        dead_role = state["all_players"][death]["role"]
        # Update all_players so is_alive reflects the death everywhere
        updated_players = dict(state["all_players"])
        updated_players[death] = {**updated_players[death], "is_alive": False}
        updates["all_players"] = updated_players
        updates["alive_player_ids"] = new_alive
        updates["dead_player_ids"] = [death]  # Appended via Annotated[list, add] reducer
        updates["public_log"] = [f"__night_result__:death:{death}:{dead_role}"]
    else:
        updates["public_log"] = ["__night_result__:no_death"]

    # Reset night actions for next round
    updates["night_actions"] = NightActions(
        mafia_target=None,
        detective_target=None,
        medic_save=None,
    )

    return updates
