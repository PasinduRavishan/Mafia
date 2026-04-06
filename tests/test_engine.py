"""
test_engine.py — Tests for pure Python game logic. No LLM calls, no API keys needed.
"""
import pytest
from src.engine import (
    assign_roles,
    check_win_condition,
    resolve_night_actions,
    tally_votes,
)
from src.state import PlayerInfo


# --- Helpers ---

def make_player(player_id: str, alignment: str, is_alive: bool = True) -> PlayerInfo:
    return PlayerInfo(
        player_id=player_id,
        role="mafia" if alignment == "mafia" else "villager",
        alignment=alignment,
        personality="analytical",
        is_alive=is_alive,
        is_human=False,
    )


def make_night_actions(mafia_target=None, detective_target=None, medic_save=None):
    return {"mafia_target": mafia_target, "detective_target": detective_target, "medic_save": medic_save}


# --- resolve_night_actions ---

def test_cross_save():
    """Medic saves the exact player Mafia targets → no death."""
    actions = make_night_actions(mafia_target="p2", medic_save="p2", detective_target="p1")
    assert resolve_night_actions(actions) is None


def test_normal_kill():
    """Mafia targets p2, Medic saves p3 → p2 dies."""
    actions = make_night_actions(mafia_target="p2", medic_save="p3", detective_target="p1")
    assert resolve_night_actions(actions) == "p2"


def test_no_mafia_action():
    """No mafia target → no death."""
    actions = make_night_actions(mafia_target=None, medic_save="p1")
    assert resolve_night_actions(actions) is None


def test_no_medic_action():
    """Mafia targets p2, no Medic save → p2 dies."""
    actions = make_night_actions(mafia_target="p2", medic_save=None)
    assert resolve_night_actions(actions) == "p2"


# --- tally_votes ---

def test_tie_vote():
    """Equal votes → tie → None."""
    votes = {"p1": "p3", "p2": "p4"}
    assert tally_votes(votes) is None


def test_majority_vote():
    """p3 gets 2 votes, p4 gets 1 → p3 is eliminated."""
    votes = {"p1": "p3", "p2": "p3", "p3": "p4"}
    assert tally_votes(votes) == "p3"


def test_empty_votes():
    """No votes cast → None."""
    assert tally_votes({}) is None


def test_single_vote():
    """Only one voter → that target wins."""
    votes = {"p1": "p2"}
    assert tally_votes(votes) == "p2"


# --- check_win_condition ---

def test_village_wins():
    """All mafia eliminated → village wins."""
    players = {
        "p1": make_player("p1", "village"),
        "p2": make_player("p2", "village"),
    }
    assert check_win_condition(players) == "village"


def test_mafia_wins_equal():
    """1 mafia vs 1 villager → mafia wins (equal counts)."""
    players = {
        "p1": make_player("p1", "mafia"),
        "p2": make_player("p2", "village"),
    }
    assert check_win_condition(players) == "mafia"


def test_mafia_wins_majority():
    """2 mafia vs 2 villagers → mafia wins."""
    players = {
        "p1": make_player("p1", "mafia"),
        "p2": make_player("p2", "mafia"),
        "p3": make_player("p3", "village"),
        "p4": make_player("p4", "village"),
    }
    assert check_win_condition(players) == "mafia"


def test_game_continues():
    """1 mafia, 3 villagers → game continues."""
    players = {
        "p1": make_player("p1", "mafia"),
        "p2": make_player("p2", "village"),
        "p3": make_player("p3", "village"),
        "p4": make_player("p4", "village"),
    }
    assert check_win_condition(players) is None


# --- assign_roles ---

def test_assign_roles_counts():
    """Role counts must match config exactly."""
    config = {"num_mafia": 1, "has_detective": True, "has_medic": True}
    player_ids = ["human", "p1", "p2", "p3", "p4", "p5"]
    players = assign_roles(player_ids, config)

    roles = [p["role"] for p in players.values()]
    assert roles.count("mafia") == 1
    assert roles.count("detective") == 1
    assert roles.count("medic") == 1
    assert roles.count("villager") == 3


def test_assign_roles_human_flag():
    """The 'human' player_id must have is_human=True; all others False."""
    config = {"num_mafia": 1, "has_detective": True, "has_medic": True}
    player_ids = ["human", "p1", "p2", "p3", "p4", "p5"]
    players = assign_roles(player_ids, config)

    assert players["human"]["is_human"] is True
    for pid in ["p1", "p2", "p3", "p4", "p5"]:
        assert players[pid]["is_human"] is False


def test_assign_roles_all_alive():
    """All players start alive."""
    config = {"num_mafia": 1, "has_detective": True, "has_medic": True}
    player_ids = ["human", "p1", "p2", "p3", "p4", "p5"]
    players = assign_roles(player_ids, config)
    assert all(p["is_alive"] for p in players.values())
