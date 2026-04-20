# TECHNICAL_OVERVIEW.md — What We've Built So Far

> Simple, short reference. Updated after each phase.
> For deep detail see ARCHITECTURE.md. For tasks see TASKS.md.

---

## Stack

| Layer | Technology | Status |
|---|---|---|
| Game logic (pure Python) | `engine.py` | ✅ Done |
| State schema | `state.py` (TypedDict) | ✅ Done |
| Graph orchestration | LangGraph `StateGraph` | ✅ Wired |
| API server | FastAPI + Uvicorn | ✅ Done |
| NPC agents | LangChain + Claude claude-sonnet-4-6 | ✅ Done |
| Frontend | React + TypeScript + Tailwind | 📅 Phase 7 |

---

## Phase 1 — Foundation

**What:** Pure Python data types and game logic. No AI, no server, no network.

**Files:**
- `src/state.py` — Defines every piece of data the game needs (`GameState`, `PlayerInfo`, `NightActions`)
- `src/engine.py` — Four pure functions: `assign_roles`, `resolve_night_actions`, `tally_votes`, `check_win_condition`
- `src/utils/state_views.py` — `build_agent_view()`: the information firewall that ensures no player sees another's private info

**Tests:** 25/25 passing. Zero API keys needed.

---

## Phase 2 — Graph Skeleton

**What:** The LangGraph `StateGraph` wired up with all 9 nodes (stubbed — return `{}`). Defines the game flow structure.

**Files:**
- `src/graph.py` — Registers nodes, connects linear edges, adds conditional loop-back from `win_check`
- `src/nodes/*.py` — 9 stub files (all return `{}` for now)

**Verified:** Mermaid diagram generated and confirmed correct topology.

---

## Phase 3 — FastAPI Server

**What:** A running HTTP API that manages game sessions and exposes 3 endpoints.

**Files:**
- `api/main.py` — FastAPI app, CORS middleware, router registration
- `api/models.py` — Pydantic schemas for requests and responses
- `api/session.py` — In-memory game store (`GAMES` dict), `GameSession` class
- `api/routes/game.py` — Route handlers for all 3 endpoints

**Endpoints:**
| Method | Path | What it does |
|---|---|---|
| `POST` | `/game/start` | Creates game, assigns roles, returns human's view |
| `GET` | `/game/{id}/state` | Returns current filtered game state |
| `POST` | `/game/{id}/action` | Human submits night action / statement / vote |

**Tested:** All endpoints verified. 404, 409, 400 error cases working.

---

## Phase 4 — Night Phase Agents ✅

**What:** Real LangGraph execution. NPC agents call Claude LLM. Human turns use `interrupt()`.

**Files:**
- `src/agents/base_agent.py` — Lazy LLM singleton, `call_agent()`, `parse_json_response()`
- `src/utils/prompts.py` — All NPC prompt templates (night + day + vote + narrator)
- `src/nodes/setup_node.py` — State init + opening log entries
- `src/nodes/night_mafia/detective/medic_node.py` — NPC LLM calls + human interrupt
- `src/nodes/resolve_night_node.py` — Pure Python kill resolution

---

## Phase 5 — Day Phase ✅

**What:** Narrator LLM + NPC day discussion (LLM) + NPC voting (LLM) + human turns.

**Files:**
- `src/nodes/narrator_node.py` — Claude writes dramatic night announcement
- `src/nodes/day_discussion_node.py` — NPCs speak first with LLM, human speaks last via interrupt
- `src/nodes/vote_node.py` — NPC LLM votes with role hints, human votes via interrupt

---

## Phase 6 — Full Game Loop ✅

**What:** Win condition + round reset + safety cutoff + automated test driver.

**Files:**
- `src/nodes/win_check_node.py` — Checks win, resets round state, enforces max 20 rounds
- `scripts/test_game.py` — Drives a full game via HTTP API automatically (no human needed)

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| `build_agent_view()` always filters state before any agent sees it | Information isolation — cheating prevention |
| `engine.py` has zero LLM calls | Game logic must be deterministic and testable |
| LangGraph `interrupt()` for human input | Pauses graph mid-execution; resumes when human submits via API |
| `MemorySaver` checkpointer | Stores graph state between HTTP requests (one thread per game) |
| In-memory session store | Simplicity for now; Redis/DB is a future enhancement |
| `Annotated[list, add]` reducers in state | Lets multiple nodes append to `public_log` without overwriting |

---

## How to Run

```bash
# Activate virtualenv
source .venv/bin/activate

# Start API server
uvicorn api.main:app --reload

# Run tests (no API keys needed)
python -m pytest tests/

# Swagger UI
open http://localhost:8000/docs
```

## Environment Variables Needed (Phase 4+)
```
ANTHROPIC_API_KEY=    ← from console.anthropic.com
LANGSMITH_API_KEY=    ← from smith.langchain.com
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=mafia-simulation
```
