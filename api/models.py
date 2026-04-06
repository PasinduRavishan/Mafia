"""
models.py — Pydantic request/response schemas for the Mafia game API.
See docs/API.md for full endpoint spec.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field


class StartGameRequest(BaseModel):
    num_players: int = Field(default=6, ge=4, le=10)


class ActionRequest(BaseModel):
    type: Literal["night_action", "day_statement", "vote"]
    value: str  # player_id for night_action/vote; free text for day_statement


class PromptPayload(BaseModel):
    type: str                        # "night_action" | "day_statement" | "vote"
    message: str                     # Instructions shown to the human
    options: Optional[list[str]]     # Valid player_ids to choose from (None for free text)


class GameStateResponse(BaseModel):
    game_id: str
    round_number: int
    phase: str
    alive_players: list[str]
    dead_players: list[str]
    public_log: list[str]
    day_statements: list[dict]
    prompt: Optional[PromptPayload]  # None if not waiting for human input
    game_over: bool
    winner: Optional[str]
    # Role-private fields — None if not applicable to human's role
    your_role: Optional[str] = None
    mafia_teammates: Optional[list[str]] = None
    investigation_ledger: Optional[dict] = None
    medic_self_heal_used: Optional[bool] = None
