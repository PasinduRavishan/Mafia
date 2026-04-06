"""
session.py — In-memory game session store.

Each game entry holds the full GameState and metadata needed to
resume LangGraph execution when the human submits an action.

Note: All games are lost on server restart. Persistence is a future enhancement.
"""
from typing import Optional
from src.state import GameState


class GameSession:
    def __init__(self, game_id: str, state: GameState, thread_config: dict):
        self.game_id = game_id
        self.state: GameState = state
        self.thread_config = thread_config   # LangGraph {"configurable": {"thread_id": game_id}}
        self.waiting_for_human: bool = False
        self.pending_prompt: Optional[dict] = None  # The interrupt payload shown to human


# Module-level store — keyed by game_id
GAMES: dict[str, GameSession] = {}


def get_session(game_id: str) -> Optional[GameSession]:
    return GAMES.get(game_id)


def create_session(game_id: str, state: GameState) -> GameSession:
    thread_config = {"configurable": {"thread_id": game_id}}
    session = GameSession(game_id=game_id, state=state, thread_config=thread_config)
    GAMES[game_id] = session
    return session


def delete_session(game_id: str) -> None:
    GAMES.pop(game_id, None)
