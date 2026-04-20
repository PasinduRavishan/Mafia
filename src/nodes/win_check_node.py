"""
win_check_node.py — Checks win condition after every vote phase.

Uses alive_player_ids (not all_players.is_alive) as the authoritative source.
Returns routing key via the state so route_after_win_check() can branch correctly.

Also enforces max_rounds safety cutoff to prevent infinite games.
"""
from src.engine import check_win_condition
from src.state import GameState

MAX_ROUNDS = 20


def win_check_node(state: GameState) -> dict:
    # Build alive players dict from alive_player_ids (authoritative source)
    alive = {
        pid: state["all_players"][pid]
        for pid in state["alive_player_ids"]
    }

    winner = check_win_condition(alive)

    if winner:
        return {
            "winner": winner,
            "game_over": True,
            "phase": "ended",
            "public_log": [
                f"=== GAME OVER — {winner.upper()} WINS ==="
            ],
        }

    # Safety cutoff — prevent infinite games
    if state["round_number"] >= MAX_ROUNDS:
        return {
            "winner": None,
            "game_over": True,
            "phase": "ended",
            "public_log": [
                f"=== GAME OVER — Maximum rounds ({MAX_ROUNDS}) reached. Draw. ==="
            ],
        }

    # Game continues — reset round state and increment round number
    return {
        "phase": "night",
        "round_number": state["round_number"] + 1,
        "night_actions": {"mafia_target": None, "detective_target": None, "medic_save": None},
        "votes": {},
        "vote_result": None,
        "day_statements": [],
        "discussion_turns_left": 1,
    }
