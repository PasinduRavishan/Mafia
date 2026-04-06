"""
engine.py — Pure Python game logic. Zero LLM calls. Fully testable without API keys.
"""
import random
from collections import Counter
from typing import Optional

from src.state import Alignment, NightActions, PlayerID, PlayerInfo, Role


def assign_roles(player_ids: list[PlayerID], config: dict) -> dict[PlayerID, PlayerInfo]:
    """
    Randomly assigns roles and personalities to all players.
    One player_id must be "human" — they get a random role like everyone else.
    config keys: num_mafia, has_detective, has_medic
    """
    ids = list(player_ids)
    random.shuffle(ids)

    roles: list[tuple[Role, Alignment]] = []

    for _ in range(config["num_mafia"]):
        roles.append(("mafia", "mafia"))
    if config.get("has_detective", True):
        roles.append(("detective", "village"))
    if config.get("has_medic", True):
        roles.append(("medic", "village"))

    remaining = len(ids) - len(roles)
    for _ in range(remaining):
        roles.append(("villager", "village"))

    personalities = ["aggressive", "defensive", "analytical"]

    result: dict[PlayerID, PlayerInfo] = {}
    for player_id, (role, alignment) in zip(ids, roles):
        result[player_id] = PlayerInfo(
            player_id=player_id,
            role=role,
            alignment=alignment,
            personality=random.choice(personalities),
            is_alive=True,
            is_human=(player_id == "human"),
        )

    return result


def resolve_night_actions(night_actions: NightActions) -> Optional[PlayerID]:
    """
    Returns the player_id who died, or None if Medic saved them (cross-save).
    If mafia_target is None (no action), returns None.
    """
    target = night_actions["mafia_target"]
    save = night_actions["medic_save"]

    if target is None:
        return None
    if target == save:
        return None  # Cross-save: Medic protected the Mafia's target
    return target


def tally_votes(votes: dict[PlayerID, PlayerID]) -> Optional[PlayerID]:
    """
    Returns the player_id with the most votes, or None on a tie.
    """
    if not votes:
        return None
    counts = Counter(votes.values())
    top_two = counts.most_common(2)
    if len(top_two) > 1 and top_two[0][1] == top_two[1][1]:
        return None  # Tie
    return top_two[0][0]


def check_win_condition(alive_players: dict[PlayerID, PlayerInfo]) -> Optional[str]:
    """
    Returns 'village', 'mafia', or None (game continues).
    Mafia wins when mafia_count >= village_count.
    Village wins when mafia_count == 0.
    """
    mafia_count = sum(1 for p in alive_players.values() if p["alignment"] == "mafia")
    village_count = sum(1 for p in alive_players.values() if p["alignment"] == "village")

    if mafia_count == 0:
        return "village"
    if mafia_count >= village_count:
        return "mafia"
    return None
