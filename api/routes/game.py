"""
game.py — Route handlers for all /game endpoints.
See docs/API.md for full specification.

Phase 4 additions:
- POST /game/start now invokes the real LangGraph graph
- POST /game/{id}/action now resumes the graph via Command(resume=value)
- Interrupts are detected by checking graph.get_state(config).next
"""
import asyncio
import random
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, HTTPException
from langgraph.types import Command

# Thread pool for running blocking LangGraph/LLM calls off the async event loop
_executor = ThreadPoolExecutor(max_workers=4)

from src.engine import assign_roles
from src.graph import build_graph
from src.state import GameState, NightActions
from src.utils.state_views import build_agent_view
from api.models import ActionRequest, GameStateResponse, PromptPayload, StartGameRequest
from api.session import GameSession, create_session, get_session

router = APIRouter(prefix="/game", tags=["game"])

# One compiled graph instance shared across all games (thread_id separates them)
_graph = build_graph()

# NPC name pool — shuffled each game so names feel fresh
NPC_NAMES = [
    "Alice", "Bob", "Carlos", "Diana", "Ethan",
    "Fatima", "George", "Hannah", "Ivan", "Julia",
    "Kevin", "Lena", "Marco", "Nina", "Oscar",
]

DEFAULT_CONFIG = {
    "num_mafia": 1,
    "has_detective": True,
    "has_medic": True,
    "max_discussion_turns": 1,
    "max_rounds": 20,
    "reveal_role_on_death": True,
    "allow_medic_self_heal": True,
}


def _get_interrupt_payload(game_id: str) -> Optional[dict]:
    """
    After graph.invoke(), check if the graph paused at an interrupt().
    If so, extract and return the interrupt payload (what was passed to interrupt()).
    Returns None if graph ran to completion or is waiting for something else.
    """
    config = {"configurable": {"thread_id": game_id}}
    snapshot = _graph.get_state(config)

    # snapshot.next is non-empty when graph is paused and has more nodes to run
    if not snapshot.next:
        return None

    # Extract interrupt payload from paused tasks
    for task in snapshot.tasks:
        for intr in task.interrupts:
            return intr.value  # The dict we passed to interrupt()

    return None


def _get_current_state(game_id: str) -> Optional[GameState]:
    """Read the latest graph state from MemorySaver checkpointer."""
    config = {"configurable": {"thread_id": game_id}}
    snapshot = _graph.get_state(config)
    if snapshot and snapshot.values:
        return snapshot.values
    return None


def _is_game_over(game_id: str) -> bool:
    """Check if graph has reached END (no next nodes and game_over=True)."""
    config = {"configurable": {"thread_id": game_id}}
    snapshot = _graph.get_state(config)
    if not snapshot.next and snapshot.values:
        return snapshot.values.get("game_over", False)
    return False


def _build_response(session: GameSession) -> GameStateResponse:
    """Build a GameStateResponse from the latest graph state, filtered for the human."""
    # Always read from the graph's checkpointer — it's the source of truth
    state = _get_current_state(session.game_id) or session.state
    view = build_agent_view("human", state)

    # Check for interrupt payload
    interrupt_payload = _get_interrupt_payload(session.game_id)
    prompt: Optional[PromptPayload] = None
    if interrupt_payload:
        prompt = PromptPayload(
            type=interrupt_payload["type"],
            message=interrupt_payload["message"],
            options=interrupt_payload.get("options"),
        )
        session.waiting_for_human = True
        session.pending_prompt = interrupt_payload
    else:
        session.waiting_for_human = False
        session.pending_prompt = None

    # Filter out internal marker lines from public_log before sending to client
    clean_log = [
        line for line in state.get("public_log", [])
        if not line.startswith("__night_result__")
    ]

    return GameStateResponse(
        game_id=session.game_id,
        round_number=state["round_number"],
        phase=state["phase"],
        alive_players=state["alive_player_ids"],
        dead_players=state["dead_player_ids"],
        public_log=clean_log,
        day_statements=state["day_statements"],
        prompt=prompt,
        game_over=state["game_over"],
        winner=state["winner"],
        your_role=view["your_role"],
        mafia_teammates=view.get("mafia_teammates"),
        investigation_ledger=view.get("investigation_ledger"),
        medic_self_heal_used=view.get("medic_self_heal_used"),
    )


@router.post("/start", response_model=GameStateResponse)
async def start_game(request: StartGameRequest):
    """
    Start a new game.
    1. Assigns random roles to human + NPCs
    2. Builds initial GameState
    3. Invokes the LangGraph — graph runs setup_node + night nodes
    4. Graph pauses at the first human interrupt (or runs through night if human is villager)
    5. Returns human's filtered view + prompt (what they need to do)
    """
    game_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": game_id}}

    # Build player list with human-like NPC names
    shuffled_names = random.sample(NPC_NAMES, request.num_players - 1)
    player_ids = ["human"] + shuffled_names

    # Assign roles randomly
    all_players = assign_roles(player_ids, DEFAULT_CONFIG)

    # Build initial GameState to pass into graph
    initial_state = GameState(
        all_players=all_players,
        game_id=game_id,
        human_player_id="human",
        alive_player_ids=player_ids,
        dead_player_ids=[],
        round_number=1,
        phase="setup",
        night_actions=NightActions(mafia_target=None, detective_target=None, medic_save=None),
        public_log=[
            "The game has begun. Night falls over the village...",
            f"Players: {', '.join(player_ids)}",
        ],
        day_statements=[],
        discussion_turns_left=DEFAULT_CONFIG["max_discussion_turns"],
        votes={},
        vote_result=None,
        detective_ledger={},
        medic_self_heal_used=False,
        winner=None,
        game_over=False,
    )

    # Create session (stores game_id + metadata)
    session = create_session(game_id, initial_state)

    # ── INVOKE THE LANGGRAPH (in thread pool) ──
    # LangGraph + LLM calls are blocking/synchronous.
    # Running in a thread pool keeps the FastAPI event loop free
    # and prevents HTTP gateway timeouts on slow LLM chains.
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(_executor, lambda: _graph.invoke(initial_state, config))

    return _build_response(session)


@router.get("/{game_id}/state", response_model=GameStateResponse)
async def get_state(game_id: str):
    """
    Get current filtered game state for the human player.
    Reads from LangGraph's MemorySaver checkpointer — always fresh.
    """
    session = get_session(game_id)
    if not session:
        raise HTTPException(status_code=404, detail="Game not found.")
    return _build_response(session)


@router.post("/{game_id}/action", response_model=GameStateResponse)
async def submit_action(game_id: str, request: ActionRequest):
    """
    Human submits their action for the current interrupted turn.
    1. Validates game exists and graph is waiting for human input
    2. Validates the submitted value (must be alive player, non-empty, etc.)
    3. Calls graph.invoke(Command(resume=value)) to resume the paused graph
    4. Graph runs from the interrupt point through NPC turns until next interrupt or END
    5. Returns updated state + next prompt
    """
    session = get_session(game_id)
    if not session:
        raise HTTPException(status_code=404, detail="Game not found.")

    # Refresh interrupt state
    interrupt_payload = _get_interrupt_payload(game_id)
    if not interrupt_payload:
        raise HTTPException(
            status_code=409,
            detail="Not waiting for human input. NPC turns are in progress or game is over.",
        )

    state = _get_current_state(game_id) or session.state
    config = {"configurable": {"thread_id": game_id}}

    # ── VALIDATE THE ACTION ──
    if request.type in ("night_action", "vote"):
        target = request.value.strip()
        if target not in state["alive_player_ids"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid target '{target}': not alive or doesn't exist. "
                       f"Alive players: {state['alive_player_ids']}",
            )
        if request.type == "vote" and target == "human":
            raise HTTPException(status_code=400, detail="You cannot vote for yourself.")

    if request.type == "day_statement":
        if not request.value.strip():
            raise HTTPException(status_code=400, detail="Statement cannot be empty.")

    # ── RESUME THE LANGGRAPH ──
    # Command(resume=value) passes the human's input back to the interrupt() call.
    # The node receives it as the return value of interrupt() and continues.
    # Graph then runs through remaining NPC turns until the next interrupt or END.
    resume_value = request.value.strip()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(_executor, lambda: _graph.invoke(Command(resume=resume_value), config))

    return _build_response(session)
