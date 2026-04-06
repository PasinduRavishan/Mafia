# ARCHITECTURE.md — Mafia Interactive Game
## Technical Architecture & Design Specification

**Project:** Mafia Interactive Human-vs-LLM Game
**Stack:** Python 3.12 · FastAPI · LangGraph · LangChain (Anthropic) · LangSmith
**Frontend (planned):** React + TypeScript + Tailwind CSS
**Approach:** Spec-Driven Development with Claude Code
**Date:** April 2026

---

## 1. System Overview

This system implements the social deduction game "Mafia" as a **full-stack web game** where ONE human player competes alongside LLM-powered NPC agents.

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React — Phase 7)                         │
│  Game board · Role reveal · Live log · Action forms │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (REST)
┌────────────────────▼────────────────────────────────┐
│  FastAPI Backend (Phase 3)                          │
│  POST /game/start                                   │
│  GET  /game/{id}/state                              │
│  POST /game/{id}/action                             │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  LangGraph Game Engine                              │
│  StateGraph → nodes → interrupt() for human turns  │
│  MemorySaver checkpointer (in-memory per session)   │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  NPC Agents (Claude claude-sonnet-4-6)                      │
│  Mafia · Detective · Medic · Villager               │
│  Each sees only build_agent_view() filtered state   │
└─────────────────────────────────────────────────────┘
```

### Human Player Integration — LangGraph Interrupt Pattern

The human is NOT polled via `input()`. Instead, LangGraph's `interrupt()` mechanism pauses the graph mid-execution and hands control back to FastAPI:

```
1. Graph runs NPC turns automatically
2. When it's the human's turn → node calls interrupt(payload)
   - payload = filtered agent view (what the human is allowed to see)
3. Graph execution pauses; FastAPI returns 200 with the payload to client
4. Client displays the prompt (e.g. "Who do you vote for?")
5. Human submits POST /game/{id}/action with their response
6. FastAPI resumes the graph with graph.invoke(Command(resume=human_input))
7. Graph continues from where it paused
```

This is the canonical LangGraph human-in-the-loop pattern. No polling, no `input()`, fully async-compatible.

**Key Design Principles:**
- **Determinism in logic, creativity in language.** `engine.py` handles all kill resolution, vote tallying, win checks. LLMs only generate dialogue and decisions.
- **Information silos.** Every participant (human or LLM) receives only `build_agent_view()` output — never raw `GameState`.
- **Bounded loops.** `discussion_turns_left` counter prevents infinite day discussion.
- **Stateless API.** FastAPI is stateless per request. Game state lives in LangGraph's `MemorySaver` checkpointer, keyed by `game_id`.
- **Full observability.** LangSmith traces every node and agent call with game metadata.

---

## 2. Game Rules Summary

### Roles & Capabilities

| Role | Team | Night Action | Private Knowledge |
|---|---|---|---|
| Mafia (Thief) | Mafia | Choose one player to eliminate | Knows all other Mafia members |
| Villager | Village | None (sleeps) | No private knowledge |
| Detective (Police) | Village | Investigate one player → get Mafia/Innocent result | Maintains private investigation ledger |
| Medic (Doctor) | Village | Protect one player from elimination | Knows who they saved; not if attack occurred |

### Game Cycle

```
SETUP → NIGHT (Mafia → Detective → Medic) → RESOLVE → NARRATOR → DAY DISCUSSION → VOTE → WIN CHECK → (loop or END)
```

### Victory Conditions
- **Village wins:** All Mafia members are eliminated
- **Mafia wins:** `mafia_count >= village_count` among living players (e.g., 1 Mafia vs 1 Villager = Mafia win)

### Critical Edge Cases
- **Cross-save:** If Mafia targets Player A and Medic saves Player A → "No one died last night"
- **Tie vote:** No one is eliminated; game proceeds to next night
- **Last stand:** 3 players remaining (1 Mafia, 2 Village) — village must vote correctly or Mafia wins next night
- **Self-heal:** Medic can protect themselves (configurable; default allowed once per game)

---

## 3. GameState Schema

The `GameState` TypedDict is the backbone of the entire LangGraph workflow. Every node reads from and writes partial updates back to this state.

```python
# src/state.py

from typing import TypedDict, Annotated, Literal, Optional
from operator import add

PlayerID = str  # e.g., "player_1", "player_2"
Role = Literal["mafia", "detective", "medic", "villager"]
Alignment = Literal["mafia", "village"]

class PlayerInfo(TypedDict):
    player_id: PlayerID
    role: Role
    alignment: Alignment
    personality: Literal["aggressive", "defensive", "analytical"]
    is_alive: bool

class NightActions(TypedDict):
    mafia_target: Optional[PlayerID]      # Who Mafia chose to kill
    detective_target: Optional[PlayerID]  # Who Detective investigated
    medic_save: Optional[PlayerID]        # Who Medic protected

class GameState(TypedDict):
    # --- Static (set during setup, never changes) ---
    all_players: dict[PlayerID, PlayerInfo]   # Full roster (includes roles)
    game_id: str                               # Unique ID for LangSmith
    human_player_id: PlayerID                  # Always "human" — identifies the human slot

    # --- Dynamic: Who is alive ---
    alive_player_ids: list[PlayerID]           # Only living players
    dead_player_ids: Annotated[list[PlayerID], add]  # Accumulates deaths

    # --- Round tracking ---
    round_number: int
    phase: Literal["setup", "night", "day", "vote", "ended"]

    # --- Night phase (reset each round) ---
    night_actions: NightActions

    # --- Day phase ---
    public_log: Annotated[list[str], add]      # Everything players can see (accumulates)
    day_statements: Annotated[list[dict], add] # List of {player_id, statement} dicts
    discussion_turns_left: int                  # Countdown to end discussion

    # --- Vote phase ---
    votes: dict[PlayerID, PlayerID]            # voter_id → voted_for_id
    vote_result: Optional[PlayerID]            # Who was eliminated by vote

    # --- Private agent state (NEVER sent to wrong agents) ---
    detective_ledger: dict[PlayerID, Alignment]  # Detective's private records
    medic_self_heal_used: bool                   # Track medic's once-per-game rule

    # --- Game result ---
    winner: Optional[Literal["village", "mafia"]]
    game_over: bool
```

### State Update Pattern

Nodes return **partial dicts** — only the keys they changed:

```python
# CORRECT ✅
def resolve_night_node(state: GameState) -> dict:
    death = compute_death(state["night_actions"])
    return {
        "dead_player_ids": [death] if death else [],
        "alive_player_ids": [p for p in state["alive_player_ids"] if p != death],
        "round_number": state["round_number"] + 1,
    }

# WRONG ❌ — never return or mutate full state
def resolve_night_node(state: GameState) -> GameState:
    state["round_number"] += 1  # This mutates in place — breaks LangGraph reducers
    return state
```

---

## 4. Graph Architecture

### Node Map

```
START
  │
  ▼
[setup_node]          → Assigns roles, initializes state
  │
  ▼
[night_mafia_node]    → Mafia agent picks kill target
  │
  ▼
[night_detective_node] → Detective agent investigates one player
  │
  ▼
[night_medic_node]    → Medic agent picks one player to save
  │
  ▼
[resolve_night_node]  → Pure Python: compare target vs save, update alive/dead
  │
  ▼
[narrator_node]       → LLM: generates story-flavored announcement of night events
  │
  ▼
[day_discussion_node] → All living agents generate statements (bounded by turns counter)
  │
  ▼
[vote_node]           → All living agents vote; Python tallies result
  │
  ▼
[win_check_node]      → Conditional routing:
                          "mafia_wins"   → END
                          "village_wins" → END
                          "continue"     → back to night_mafia_node
```

### Graph Wiring (src/graph.py)

```python
from langgraph.graph import StateGraph, START, END
from src.state import GameState

def build_graph() -> CompiledGraph:
    builder = StateGraph(GameState)

    # Register nodes
    builder.add_node("setup", setup_node)
    builder.add_node("night_mafia", night_mafia_node)
    builder.add_node("night_detective", night_detective_node)
    builder.add_node("night_medic", night_medic_node)
    builder.add_node("resolve_night", resolve_night_node)
    builder.add_node("narrator", narrator_node)
    builder.add_node("day_discussion", day_discussion_node)
    builder.add_node("vote", vote_node)
    builder.add_node("win_check", win_check_node)

    # Linear edges
    builder.add_edge(START, "setup")
    builder.add_edge("setup", "night_mafia")
    builder.add_edge("night_mafia", "night_detective")
    builder.add_edge("night_detective", "night_medic")
    builder.add_edge("night_medic", "resolve_night")
    builder.add_edge("resolve_night", "narrator")
    builder.add_edge("narrator", "day_discussion")
    builder.add_edge("day_discussion", "vote")
    builder.add_edge("vote", "win_check")

    # Conditional loop-back or end
    builder.add_conditional_edges(
        "win_check",
        route_after_win_check,   # Returns "continue", "mafia_wins", or "village_wins"
        {
            "continue": "night_mafia",
            "mafia_wins": END,
            "village_wins": END,
        }
    )

    return builder.compile()
```

---

## 5. Information Isolation (Critical)

This is the most important engineering constraint. The `build_agent_view()` function in `src/utils/state_views.py` is the ONLY way agents should receive game state.

```python
# src/utils/state_views.py

def build_agent_view(player_id: PlayerID, state: GameState) -> dict:
    """
    Returns a filtered view of game state safe to pass to the specified player's LLM.
    NEVER passes role information the player shouldn't know.
    """
    player = state["all_players"][player_id]
    role = player["role"]
    
    base_view = {
        "your_player_id": player_id,
        "your_role": role,
        "your_personality": player["personality"],
        "round_number": state["round_number"],
        "alive_players": state["alive_player_ids"],
        "public_log": state["public_log"],
        "day_statements": state["day_statements"],
    }
    
    # Role-specific private knowledge
    if role == "mafia":
        mafia_ids = [
            pid for pid, p in state["all_players"].items()
            if p["alignment"] == "mafia" and pid != player_id
        ]
        base_view["mafia_teammates"] = mafia_ids
        # NEVER include detective_ledger, other roles, etc.
    
    elif role == "detective":
        base_view["investigation_ledger"] = state["detective_ledger"]
        # Only the detective's own private records
    
    elif role == "medic":
        base_view["medic_self_heal_used"] = state["medic_self_heal_used"]
        # No other private information
    
    # Villagers get only the base_view — no private knowledge at all
    
    return base_view
```

---

## 6. Agent Architecture

### Base Agent Pattern

All agents share a common structure. Role-specific behavior is injected via system prompt and the filtered state view.

```python
# src/agents/base_agent.py

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)

def call_agent(system_prompt: str, user_context: dict) -> str:
    """
    Calls the LLM with a scoped system prompt and filtered game view.
    Returns the agent's natural language response.
    """
    context_text = format_context_for_prompt(user_context)
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context_text),
    ]
    
    response = llm.invoke(messages)
    return response.content
```

### Agent Personality Modes

Each NPC is randomly assigned a personality at game start. This affects how the LLM is prompted:

| Personality | Behavior |
|---|---|
| `aggressive` | Frequently accuses others; pushes hard for votes; deflects suspicion loudly |
| `defensive` | Speaks only when accused; gives short answers; avoids drawing attention |
| `analytical` | Cites the public_log to find contradictions; reasons step-by-step |

The personality is included in every agent's system prompt to shape dialogue style.

---

## 7. Pure Python Game Engine

All game logic is in `src/engine.py`. No LLM calls. Fully testable without API keys.

```python
# src/engine.py

def assign_roles(player_ids: list[str], config: dict) -> dict[str, PlayerInfo]:
    """Randomly assigns roles based on config (num_mafia, has_detective, has_medic)."""
    ...

def resolve_night_actions(night_actions: NightActions) -> Optional[PlayerID]:
    """
    Returns the player_id who died, or None if Medic saved them.
    Cross-save: if mafia_target == medic_save → return None
    """
    if night_actions["mafia_target"] == night_actions["medic_save"]:
        return None
    return night_actions["mafia_target"]

def tally_votes(votes: dict[PlayerID, PlayerID]) -> Optional[PlayerID]:
    """
    Returns the player_id with the most votes, or None on a tie.
    """
    from collections import Counter
    if not votes:
        return None
    counts = Counter(votes.values())
    top_two = counts.most_common(2)
    if len(top_two) > 1 and top_two[0][1] == top_two[1][1]:
        return None  # Tie — no elimination
    return top_two[0][0]

def check_win_condition(alive_players: dict[PlayerID, PlayerInfo]) -> Optional[str]:
    """
    Returns 'mafia', 'village', or None (game continues).
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
```

---

## 8. LangSmith Observability Setup

LangSmith traces every agent call automatically when `LANGSMITH_TRACING=true` is set. Enrich traces with game metadata for easy debugging.

```python
# In every node, pass config with metadata:
def night_mafia_node(state: GameState, config: RunnableConfig) -> dict:
    tagged_config = {
        **config,
        "tags": ["night_phase", "mafia_agent", f"round_{state['round_number']}"],
        "metadata": {
            "game_id": state["game_id"],
            "round": state["round_number"],
            "alive_count": len(state["alive_player_ids"]),
        }
    }
    # ... agent call using tagged_config
```

### What to Watch in LangSmith
- **Each round** appears as a nested trace group tagged with `game_id` and `round_N`
- **Night phase nodes** show what each role agent decided (target/investigate/save)
- **Day discussion** shows each NPC's statement — trace these to debug bland or repetitive dialogue
- **Win check** shows the final state that triggered game end

---

## 9. Project Setup

### Installation

```bash
# 1. Clone / create project
cd ~/Desktop/intern/mafia

# 2. Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install langgraph langchain-anthropic langchain-core langsmith pydantic pytest

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 5. Verify setup
python -c "import langgraph; print('LangGraph OK')"
```

### requirements.txt

```
langgraph>=0.2.0
langchain-anthropic>=0.3.0
langchain-core>=0.3.0
langsmith>=0.2.0
pydantic>=2.0
python-dotenv>=1.0
pytest>=8.0
```

---

## 10. Testing Strategy

### Phase 1: No-LLM Tests (test_engine.py)
These must pass before any LLM code is written:

```python
def test_cross_save():
    actions = {"mafia_target": "p2", "medic_save": "p2", "detective_target": "p1"}
    assert resolve_night_actions(actions) is None

def test_normal_kill():
    actions = {"mafia_target": "p2", "medic_save": "p3", "detective_target": "p1"}
    assert resolve_night_actions(actions) == "p2"

def test_mafia_win_condition():
    # 1 mafia, 1 villager → mafia wins
    players = {"p1": mafia_player, "p2": villager_player}
    assert check_win_condition(players) == "mafia"

def test_village_win_condition():
    # 0 mafia remaining → village wins
    players = {"p1": villager_player, "p2": villager_player}
    assert check_win_condition(players) == "village"

def test_tie_vote():
    votes = {"p1": "p3", "p2": "p4"}  # Equal votes
    assert tally_votes(votes) is None
```

### Phase 2: Information Isolation Tests (test_state_views.py)

```python
def test_villager_cannot_see_roles():
    view = build_agent_view("villager_1", full_state)
    assert "mafia_teammates" not in view
    assert "investigation_ledger" not in view

def test_mafia_sees_only_teammates():
    view = build_agent_view("mafia_1", full_state)
    assert "mafia_teammates" in view
    assert "investigation_ledger" not in view
```

---

## 11. Spec-Driven Development Workflow with Claude Code

This project follows **spec-driven development** (SDD). The key idea: specs first, code second.

### The Workflow

1. **Read CLAUDE.md** — Claude Code loads the project constitution on every session
2. **Check TASKS.md** — Find the current phase and next uncompleted task
3. **Read relevant spec** — e.g., re-read `engine.py` spec section before implementing it
4. **Implement one task at a time** — atomic commits after each task
5. **Run tests** — verify before moving to the next task
6. **Update TASKS.md** — mark task complete, move to next

### Tips for Working with Claude Code

- **Start each session with:** `"Read CLAUDE.md and TASKS.md, then tell me the current status"`
- **For a new task:** `"Implement task 3.2 from TASKS.md following the spec in ARCHITECTURE.md"`
- **For debugging:** `"A test in test_engine.py is failing — the cross-save logic is wrong. Read engine.py spec in ARCHITECTURE.md and fix it"`
- **Context compaction:** If context runs low, the spec files re-anchor Claude Code. Architecture.md is re-injected from disk — no state is lost.
- **Never skip the spec step.** Jumping straight to code without reading the relevant spec section is the main cause of drift.

### File Roles for Claude Code

| File | Claude Code Uses It For |
|---|---|
| `CLAUDE.md` | Loaded at every session start — project rules and layout |
| `ARCHITECTURE.md` | Technical reference — read specific sections for each task |
| `GAME_RULES.md` | Edge case reference — consulted when implementing engine/nodes |
| `AGENT_PROMPTS.md` | Copy-paste prompt templates when building agent nodes |
| `TASKS.md` | Track progress — check off tasks, see what comes next |
