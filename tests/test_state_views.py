"""
test_state_views.py — Tests for information isolation. No LLM calls needed.
"""
import pytest
from src.state import GameState, NightActions
from src.utils.state_views import build_agent_view


# --- Test fixture: a full GameState with known roles ---

def make_full_state() -> GameState:
    return GameState(
        all_players={
            "human": {
                "player_id": "human",
                "role": "villager",
                "alignment": "village",
                "personality": "analytical",
                "is_alive": True,
                "is_human": True,
            },
            "mafia_1": {
                "player_id": "mafia_1",
                "role": "mafia",
                "alignment": "mafia",
                "personality": "aggressive",
                "is_alive": True,
                "is_human": False,
            },
            "detective_1": {
                "player_id": "detective_1",
                "role": "detective",
                "alignment": "village",
                "personality": "analytical",
                "is_alive": True,
                "is_human": False,
            },
            "medic_1": {
                "player_id": "medic_1",
                "role": "medic",
                "alignment": "village",
                "personality": "defensive",
                "is_alive": True,
                "is_human": False,
            },
            "villager_1": {
                "player_id": "villager_1",
                "role": "villager",
                "alignment": "village",
                "personality": "defensive",
                "is_alive": True,
                "is_human": False,
            },
        },
        game_id="test-game-001",
        human_player_id="human",
        alive_player_ids=["human", "mafia_1", "detective_1", "medic_1", "villager_1"],
        dead_player_ids=[],
        round_number=1,
        phase="night",
        night_actions=NightActions(mafia_target=None, detective_target=None, medic_save=None),
        public_log=["The game has begun."],
        day_statements=[],
        discussion_turns_left=3,
        votes={},
        vote_result=None,
        detective_ledger={"mafia_1": "mafia"},
        medic_self_heal_used=False,
        winner=None,
        game_over=False,
    )


# --- Villager isolation ---

def test_villager_cannot_see_roles():
    state = make_full_state()
    view = build_agent_view("human", state)
    assert "mafia_teammates" not in view
    assert "investigation_ledger" not in view
    assert "medic_self_heal_used" not in view


def test_villager_sees_public_info():
    state = make_full_state()
    view = build_agent_view("human", state)
    assert view["your_role"] == "villager"
    assert "alive_players" in view
    assert "public_log" in view


# --- Mafia isolation ---

def test_mafia_sees_only_teammates():
    state = make_full_state()
    view = build_agent_view("mafia_1", state)
    assert "mafia_teammates" in view
    assert "investigation_ledger" not in view
    assert "medic_self_heal_used" not in view


def test_mafia_cannot_see_detective_ledger():
    state = make_full_state()
    view = build_agent_view("mafia_1", state)
    assert "investigation_ledger" not in view


def test_mafia_teammates_excludes_self():
    state = make_full_state()
    view = build_agent_view("mafia_1", state)
    assert "mafia_1" not in view["mafia_teammates"]


# --- Detective isolation ---

def test_detective_sees_only_ledger():
    state = make_full_state()
    view = build_agent_view("detective_1", state)
    assert "investigation_ledger" in view
    assert "mafia_teammates" not in view
    assert "medic_self_heal_used" not in view


def test_detective_ledger_contents():
    state = make_full_state()
    view = build_agent_view("detective_1", state)
    assert view["investigation_ledger"] == {"mafia_1": "mafia"}


# --- Medic isolation ---

def test_medic_sees_self_heal_flag():
    state = make_full_state()
    view = build_agent_view("medic_1", state)
    assert "medic_self_heal_used" in view
    assert view["medic_self_heal_used"] is False


def test_medic_cannot_see_detective_ledger():
    state = make_full_state()
    view = build_agent_view("medic_1", state)
    assert "investigation_ledger" not in view


def test_villager_cannot_see_mafia_teammates():
    state = make_full_state()
    view = build_agent_view("villager_1", state)
    assert "mafia_teammates" not in view
