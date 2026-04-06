from typing import TypedDict, Annotated, Literal, Optional
from operator import add

PlayerID = str  # e.g., "player_1", "human"
Role = Literal["mafia", "detective", "medic", "villager"]
Alignment = Literal["mafia", "village"]


class PlayerInfo(TypedDict):
    player_id: PlayerID
    role: Role
    alignment: Alignment
    personality: Literal["aggressive", "defensive", "analytical"]
    is_alive: bool
    is_human: bool  # True for the one human player


class NightActions(TypedDict):
    mafia_target: Optional[PlayerID]      # Who Mafia chose to kill
    detective_target: Optional[PlayerID]  # Who Detective investigated
    medic_save: Optional[PlayerID]        # Who Medic protected


class GameState(TypedDict):
    # --- Static (set during setup, never changes) ---
    all_players: dict[PlayerID, PlayerInfo]  # Full roster (includes roles)
    game_id: str                              # Unique ID for LangSmith
    human_player_id: PlayerID                 # Always "human"

    # --- Dynamic: Who is alive ---
    alive_player_ids: list[PlayerID]          # Only living players
    dead_player_ids: Annotated[list[PlayerID], add]  # Accumulates deaths

    # --- Round tracking ---
    round_number: int
    phase: Literal["setup", "night", "day", "vote", "ended"]

    # --- Night phase (reset each round) ---
    night_actions: NightActions

    # --- Day phase ---
    public_log: Annotated[list[str], add]  # Everything all players can see (accumulates forever)
    day_statements: list[dict]             # {player_id, statement} — reset each round
    discussion_turns_left: int             # Countdown; 0 = skip to vote

    # --- Vote phase ---
    votes: dict[PlayerID, PlayerID]   # voter_id → voted_for_id
    vote_result: Optional[PlayerID]   # Who was eliminated by vote (None = tie)

    # --- Private agent state (NEVER sent to wrong agents) ---
    detective_ledger: dict[PlayerID, Alignment]  # Detective's private records
    medic_self_heal_used: bool                   # Track once-per-game self-heal

    # --- Game result ---
    winner: Optional[Literal["village", "mafia"]]
    game_over: bool
