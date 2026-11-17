# Intern Diary — Mafia Interactive Game Project

**Intern:** Pasindu Ravishan
**Project:** Mafia Interactive Human-vs-LLM Game
**Stack:** Python · FastAPI · LangGraph · LangChain (Anthropic Claude) · LangSmith · React · TypeScript · Tailwind CSS · GSAP · Docker
**Period:** April 6, 2026 – April 20, 2026

---

## Overview

Built a full-stack, interactive implementation of the social deduction game **Mafia** from scratch in approximately two weeks. The game pits one human player against multiple LLM-powered NPC agents (powered by Anthropic's Claude Sonnet). The human is randomly assigned a role (Mafia, Detective, Medic, or Villager) and plays alongside AI opponents who autonomously handle all other roles. The project follows **spec-driven development** using Claude Code as the AI pair programmer, with LangGraph for game orchestration and a React frontend for the game UI.

**Total commits:** 27  
**Files created:** ~65+ files across backend, frontend, docs, tests, and deployment config  
**Lines of code written:** ~12,000+

---

## Week 1 — April 6, 2026

### April 6, 2026 (Morning) — Phase 1: Foundation & Game Engine

**Commit:** `b8c6362` · 11:29 AM  
**Goal:** Build all pure Python data structures and game logic. No LLM, no server, no network.

#### What Was Designed & Built

**Project architecture decision:**
- Chose a **spec-driven development** approach — wrote all documentation and architecture specs _before_ writing any code
- Decided on a strict separation: `engine.py` handles all game logic deterministically in pure Python; LLMs are _only_ used for generating natural language dialogue and decisions
- Designed a critical **information isolation** system: no player (human or LLM) ever sees the full game state — each gets only a filtered view via `build_agent_view()`

**Files created (19 files, 2,037 lines):**

| File | Purpose |
|------|---------|
| `src/state.py` | `GameState`, `PlayerInfo`, `NightActions` TypedDicts — the entire game's data schema |
| `src/engine.py` | Four pure Python game logic functions — no LLM calls |
| `src/utils/state_views.py` | `build_agent_view()` — the information firewall |
| `tests/test_engine.py` | 15 unit tests for game logic |
| `tests/test_state_views.py` | 10 unit tests for information isolation |
| `docs/ARCHITECTURE.md` | Full 500-line technical architecture spec |
| `docs/GAME_RULES.md` | Complete 200-line game rules and edge cases doc |
| `docs/AGENT_PROMPTS.md` | 316-line LLM prompt template library |
| `docs/TASKS.md` | 254-line phased implementation task list |
| `CLAUDE.md` | 211-line project constitution for Claude Code |

**Key algorithms implemented in `engine.py`:**
- `assign_roles(player_ids, config)` — randomly distributes Mafia/Detective/Medic/Villager roles
- `resolve_night_actions(night_actions)` — handles the **cross-save scenario** (if Mafia targets Player A and Medic saves Player A → nobody dies)
- `tally_votes(votes)` — counts votes and handles **tie scenario** (no elimination)
- `check_win_condition(alive_players)` — detects Mafia win (mafia_count ≥ village_count) and Village win (0 mafia alive)

**GameState TypedDict fields designed:**
- `all_players` — full roster with roles (never directly exposed to agents)
- `alive_player_ids` / `dead_player_ids` — dynamic living/dead tracking
- `night_actions` — reset each round (mafia kill target, detective investigation, medic save)
- `public_log` — accumulating record of everything all players can see (uses LangGraph `Annotated[list, add]` reducer)
- `detective_ledger` — private investigation records, only visible to the detective
- `discussion_turns_left` — prevents infinite day discussion loops
- `votes`, `vote_result`, `game_over`, `winner` — game flow control

**`build_agent_view()` — information isolation logic:**
- Mafia agents see: their role + list of their Mafia teammates only
- Detective agents see: their role + their private investigation ledger only
- Medic agents see: their role + whether they've used their once-per-game self-heal
- Villager agents see: only the public log — zero private information

**Test results:** 25/25 tests passing. Zero API keys required.

---

### April 6, 2026 (Afternoon/Evening) — Phases 2–6: Graph, API, Agents, Full Loop

**Commit:** `a655834` · 7:57 PM  
**Goal:** Wire the entire game — LangGraph graph, FastAPI server, all NPC agents, full game loop.

This was the largest single day of development, covering Phases 2 through 6 in one extended session (approximately 8 hours of work).

#### Phase 2 — LangGraph Graph Skeleton

**Files created:**
- `src/graph.py` — `StateGraph` with all 9 nodes registered and wired

**Graph topology designed and implemented:**
```
START → setup → night_mafia → night_detective → night_medic →
resolve_night → narrator → day_discussion → vote →
win_check → (continue: back to night_mafia) | (mafia_wins: END) | (village_wins: END)
```

Key LangGraph patterns learned and applied:
- `StateGraph(GameState)` — typed state graph
- `add_edge()` for linear connections
- `add_conditional_edges()` with routing function for the win-check loop-back
- `builder.compile(checkpointer=MemorySaver())` — in-memory state persistence between HTTP requests

Verified graph compiled and generated a correct Mermaid diagram.

#### Phase 3 — FastAPI Server

**Files created:**
- `api/__init__.py`, `api/main.py` — FastAPI app with CORS middleware
- `api/models.py` — Pydantic v2 request/response schemas
- `api/session.py` — In-memory `GAMES` dictionary keyed by `game_id` (UUID4)
- `api/routes/__init__.py`, `api/routes/game.py` — Route handlers
- `docs/API.md` — 233-line REST API specification

**Three API endpoints implemented:**
| Method | Path | Function |
|--------|------|----------|
| `POST` | `/game/start` | Creates session, assigns roles, starts LangGraph, returns human's role + first prompt |
| `GET` | `/game/{game_id}/state` | Returns filtered state view for the human |
| `POST` | `/game/{game_id}/action` | Human submits night action / discussion statement / vote; resumes the paused graph |

**LangGraph interrupt pattern implemented (the key human-in-the-loop mechanism):**
1. Game graph runs NPC turns automatically
2. When it's the human's turn → node calls `interrupt(filtered_agent_view)`
3. Graph execution _pauses_; FastAPI returns 200 with the payload to the client
4. Human submits `POST /game/{id}/action` with their response
5. FastAPI calls `graph.invoke(Command(resume=human_input), config)` to resume
6. Graph continues from the exact pause point

**Error handling:** 404 (game not found), 409 (not waiting for human), 400 (invalid target — dead player, self-target, etc.)

#### Phase 4 — Night Phase NPC Agents

**Files created:**
- `src/agents/base_agent.py` — Shared LLM infrastructure
- `src/utils/prompts.py` — All prompt templates (233 lines)
- `src/nodes/setup_node.py` — Full game initialization
- `src/nodes/night_mafia_node.py` — Mafia kill decision
- `src/nodes/night_detective_node.py` — Detective investigation
- `src/nodes/night_medic_node.py` — Medic save decision
- `src/nodes/resolve_night_node.py` — Pure Python kill resolution

**`base_agent.py` design:**
- Lazy singleton LLM instance: `ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)`
- `call_agent(system_prompt, user_context) -> str` — universal LLM call wrapper
- `parse_json_response(response_text) -> dict` — extracts JSON from LLM output (handles markdown code blocks)
- `format_context_for_prompt(context_dict) -> str` — serializes filtered game state for prompt injection

**NPC agent pattern in each night node:**
```python
def night_mafia_node(state: GameState) -> dict:
    if state["human_player_id"] == mafia_player:
        return interrupt(build_agent_view("human", state))  # Human's turn
    view = build_agent_view(mafia_id, state)
    response = call_agent(MAFIA_NIGHT_PROMPT, view)
    target = parse_json_response(response)["target"]
    return {"night_actions": {"mafia_target": target, ...}}
```

**Agent personalities:** Each NPC is randomly assigned `aggressive`, `defensive`, or `analytical` — injected into the system prompt to diversify NPC behaviour.

#### Phase 5 — Day Phase

**Files created:**
- `src/nodes/narrator_node.py` — LLM generates dramatic night announcement
- `src/nodes/day_discussion_node.py` — Full discussion loop with bounded turns
- `src/nodes/vote_node.py` — NPC vote decisions + human vote interrupt

**`day_discussion_node.py` key design:**
- Iterates all living players in order
- Checks `discussion_turns_left > 0` before continuing (prevents infinite token loops)
- For each NPC: calls LLM with day discussion prompt + filtered state view
- For human: calls `interrupt()` to pause and wait for human's typed statement
- Each statement appended to both `day_statements` and `public_log`
- `discussion_turns_left` decremented after each full round

**`vote_node.py` key design:**
- Each living NPC calls LLM with vote prompt + role hints (detective uses their ledger)
- Human: `interrupt()` pause → resumes with player ID they type to vote out
- Calls `engine.tally_votes()` → handles ties (no elimination)
- Updates `alive_player_ids` and `dead_player_ids`
- Result appended to `public_log`

#### Phase 6 — Full Game Loop

**Files created:**
- `src/nodes/win_check_node.py` — Win condition checker + round reset + safety cutoff
- `docs/TECHNICAL_OVERVIEW.md` — 117-line summary of all completed phases

**`win_check_node.py` logic:**
- Calls `engine.check_win_condition()` with current alive players
- If village wins or Mafia wins → sets `game_over = True`, `winner = "village"/"mafia"`, routes to END
- If game continues → resets `night_actions`, `day_statements`, `votes`, `discussion_turns_left`; increments `round_number`; routes back to `night_mafia` node
- Safety cutoff: `round_number >= 20` → forced end to prevent runaway games

**Total new files in this commit:** 24 files, 1,869 insertions

---

### April 7, 2026 — Testing Phase & Bug Fixes

**Commit:** `5395f7c` · 4:02 PM  
**Goal:** End-to-end testing of the complete game loop and fixing bugs found during testing.

#### What Was Done

**New file — `scripts/test_game.py` (251 lines):**
- Automated test driver that plays a complete Mafia game via HTTP API with no human in the loop
- `auto_play_game()` — calls `/game/start`, then repeatedly calls `/game/{id}/action` with auto-generated responses (random night targets, random discussion statements, random votes)
- Verifies both Mafia win and Village win scenarios terminate correctly
- Verifies `round_number >= 20` safety cutoff halts the game
- Prints a complete game transcript to the console

**Bugs found and fixed during testing:**

1. **`day_discussion_node.py` (100 lines rewritten):**
   - Discovered the discussion loop was not correctly handling the `discussion_turns_left` counter when the human was a participant mid-loop
   - Fixed player ordering to ensure consistent iteration across rounds
   - Added proper logging of NPC statements to `public_log` with player ID prefixes

2. **`narrator_node.py` (rewritten with 42 additional lines):**
   - Fixed narrator failing when no player died (medic cross-save scenario)
   - Added conditional narration: "No one was found dead this morning" vs. "[Player X] was found dead"

3. **`vote_node.py` (102 lines rewritten):**
   - Fixed vote tallying not being called correctly after all votes were collected
   - Fixed dead player removal from `alive_player_ids` list when vote result was non-None
   - Added "no elimination" log entry for tie votes

4. **`night_mafia_node.py` and `night_detective_node.py`:**
   - Added validation: LLM-chosen targets must be alive and not the agent themselves
   - Added fallback: if LLM returns invalid JSON, randomly select a valid target

5. **`api/routes/game.py`:**
   - Fixed game state response not reflecting post-action graph state
   - Fixed 500 error when graph reached END state after a `POST /game/{id}/action` call

---

## Week 2 — April 20, 2026

### April 20, 2026 (Afternoon) — Phase 7: React Frontend Build

**Commit:** `cd8a0ad` · 6:38 PM  
**Goal:** Build a complete, cinematic web frontend for the game.

This was the most visually complex phase. A full React + TypeScript + Tailwind CSS application was built from scratch in a single session, totalling approximately **9,542 lines of new code** across 47 files.

#### Tech Stack Chosen for Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React + Vite + TypeScript | Latest | SPA framework — no SSR needed |
| Tailwind CSS | v3 | Utility-first styling |
| DaisyUI | v4 | Component theme system — "night" dark theme as base |
| GSAP (GreenSock) | v3 | ALL game animations — eye open/close, card flip, shatter, typewriter |
| Howler.js | v2 | Sound effects — crickets, heartbeat, morning birds, vote drumroll |
| tsParticles | Latest | Fog/firefly ambient particle effects |

**Design system established:**
```css
--bg:       #0d0d0d   /* near black background */
--card:     #1a1a2e   /* dark navy card surface */
--accent:   #e8a838   /* lantern amber — primary CTA */
--mafia:    #c0392b   /* blood red — Mafia role color */
--detective:#2980b9   /* midnight blue — Detective role color */
--medic:    #27ae60   /* forest green — Medic role color */
--villager: #7f8c8d   /* muted grey — Villager role color */
```

**Fonts used:** Cinzel Decorative (title/headers), Lora (narrator text), Inter (UI chrome), JetBrains Mono (game log)

#### Files Built

**Screens (`src/components/screens/`):**

| File | Lines | Description |
|------|-------|-------------|
| `LandingScreen.tsx` | 304 | Title screen with animated hero, player count selector, "Start Game" button that calls `POST /game/start` |
| `RoleRevealScreen.tsx` | 416 | Cinematic 3D card flip revealing the human's assigned role with role-specific color theming and flavor text |
| `GameScreen.tsx` | 480 | The main persistent game view — manages all phase transitions, holds the round table scene |
| `GameOverScreen.tsx` | 206 | Winner announcement with full role reveal of all NPC players, "Play Again" button |

**Game Board (`src/components/game/`):**

| File | Lines | Description |
|------|-------|-------------|
| `RoundTable.tsx` | 453 | The central persistent scene — circular table with all player seats arranged around it, player name cards, alive/dead indicators, NPC speech bubbles that stagger in one-by-one |
| `NarratorBox.tsx` | 48 | Dramatic narrator text panel using GSAP typewriter animation, styled with Lora serif font |

**Game Phase Components (`src/components/phases/`):**

| File | Lines | Description |
|------|-------|-------------|
| `NightPhase.tsx` | 567 | Night scene overlay with animated eyelid close/open transitions, action picker for human night actions (e.g. "Choose a player to eliminate"), NPC turn progress indicators |
| `DiscussionPhase.tsx` | 534 | Day discussion panel — NPC speech bubbles stagger in one-by-one, text input for human's discussion statement, discussion turn counter |
| `VotePhase.tsx` | 510 | Voting UI — clickable player cards, game-show-style vote reveal where each vote card flips one-by-one with GSAP animation |

**Animations (`src/animations/`):**

| File | Lines | Description |
|------|-------|-------------|
| `eyeAnimation.ts` | 49 | GSAP animation for night phase transition — two panels (top and bottom) slide together like closing eyelids, then open to reveal morning |
| `shatterAnimation.ts` | 71 | GSAP animation for player death — player card shatters into shards that fall off screen |
| `typewriterAnimation.ts` | 54 | GSAP word-by-word typewriter effect for narrator text (manual character split, no SplitText plugin needed) |

**State & API Layer (`src/hooks/`, `src/api/`, `src/types/`):**

| File | Lines | Description |
|------|-------|-------------|
| `useGame.ts` | 104 | Core React hook — manages all game state with `useState`, polls `GET /game/{id}/state` on a 2-second interval, exposes `startGame()` and `submitAction()` functions |
| `api/client.ts` | 32 | Axios-based API client — configured base URL for both local dev and cloud deployment |
| `types/game.ts` | 81 | TypeScript interfaces mirroring the backend Pydantic models (GameStateResponse, PlayerView, etc.) |

**Architecture decision — no Redux, no WebSockets:**
- All game state lives in `useState` inside `useGame` hook
- Game progress is tracked by polling `GET /game/{id}/state` every 2 seconds
- This keeps the frontend simple and avoids WebSocket connection state management

**Dockerfile created:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONPATH=/app
ENV PORT=8080
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
```
Designed for deployment to Google Cloud Run (port 8080, reads `PORT` env var).

---

### April 20, 2026 (Evening) — Deployment & Production Bug Fixes

**Commits:** `fbe02b8` through `375fece` (fixes 1–13) · 6:56 PM – 11:02 PM  
**Goal:** Deploy the full-stack application and fix all production issues.

Approximately 5 hours of intensive debugging and iteration to get the application running correctly in deployment. 13 fix commits across 7 pull requests merged.

#### Bug Categories Fixed

**1. Docker / Deployment Configuration Issues (fixes 1–3, 6:56 PM – 7:03 PM)**

- `fbe02b8` — Dockerfile was too heavy; stripped down to slim Python base image, removed unnecessary build dependencies
- `2ad4d61` — FastAPI CORS configuration wasn't allowing frontend origin in production; fixed `allow_origins` list; removed `uvloop` from requirements (not compatible with slim image)
- `8ee19a6` — API route handlers returning 500 on completed games; fixed `game.py` to handle `GraphEndState` gracefully

**2. LangGraph Threading Issues (fixes 4–6, 7:44 PM – 8:08 PM)**

Production revealed a critical concurrency issue: LangGraph's `MemorySaver` was being used with multiple simultaneous requests and wasn't thread-safe in the way the session management code expected.

- `700f9f6` — Added thread-locking around graph invocations in `graph.py`
- `ea9da3c` — Expanded thread safety to cover all graph resume operations (38 lines added)
- `fecb9ff` — Refined locking strategy to per-game-id locks rather than a global lock

**3. Frontend-Backend Communication Issues (fix 7 / add+fix, 8:18–8:29 PM)**

- `6a564d4` — Updated `TASKS.md` and `TECHNICAL_OVERVIEW.md` to reflect actual deployed architecture; minor graph routing fix
- `7724a35` — Added `App.tsx` router logic (was missing the top-level screen router); fixed `GameScreen.tsx` phase detection logic; fixed `NightPhase.tsx` component not unmounting correctly between night and day phases; fixed `DiscussionPhase.tsx` not resetting on new round

**4. LangGraph State Corruption Under Polling (fixes 8–13, 8:36 PM – 11:02 PM)**

The most complex class of bugs. The 2-second state polling from the frontend was hitting the API while the LangGraph graph was mid-execution, causing state reads that returned incomplete intermediate states.

- `8ddfc4c` — Major `graph.py` refactor: moved to a simpler execution model to avoid mid-run state reads; also added Vite dependency cache files
- `7873a1e` — Fixed `typewriterAnimation.ts` not cleaning up GSAP timelines on component unmount (causing memory leak + phantom text renders); fixed `NarratorBox.tsx` not triggering animation on new narrator text; fixed `DiscussionPhase.tsx` statement accumulation order
- `d9e756f` — (Fix 9) Further graph execution serialization to prevent concurrent graph reads during invocation
- `45853c1` — (Fix 10) Major graph state management overhaul — 62 lines added to handle interrupted graph states being polled correctly (graph.py: 74 lines rewritten)
- `6c23b98` — (Fix 11) Simplified `graph.py` after fix 10 over-engineered the solution; reduced back to clean minimal approach (80 lines removed, 12 net)
- `89c19e0` — (Fix 12) Small correctness fixes in `graph.py` state routing
- `375fece` — (Fix 13) Final `graph.py` fix — added 8-line guard to handle edge case where graph reaches END while a polling request is in-flight; prevents 500 error on game completion

**Final state after all fixes:** Application deployed and running correctly in production.

---

## Summary of All Work by Phase

| Phase | Date | Description | Key Files | Tests |
|-------|------|-------------|-----------|-------|
| Phase 1 | April 6 AM | Game engine + data model | `state.py`, `engine.py`, `state_views.py` | 25/25 |
| Phase 2 | April 6 PM | LangGraph graph wiring | `graph.py`, 9 node stubs | Graph compiles |
| Phase 3 | April 6 PM | FastAPI server | `api/main.py`, `routes/game.py`, `models.py`, `session.py` | 3 endpoints verified |
| Phase 4 | April 6 PM | Night phase NPC agents | `base_agent.py`, `prompts.py`, 3 night nodes | LLM calls traced |
| Phase 5 | April 6 PM | Day phase | `narrator_node.py`, `day_discussion_node.py`, `vote_node.py` | Full round playable |
| Phase 6 | April 6 PM | Full game loop | `win_check_node.py` | Win conditions verified |
| Testing | April 7 | E2E testing + bug fixes | `scripts/test_game.py` (251 lines) | 5 node files patched |
| Phase 7 | April 20 PM | React frontend (full) | 17 TypeScript files, ~4,200 lines of React/TS | 4 screens, 3 phases, 3 animations |
| Deployment | April 20 Evening | Docker + 13 production fixes | `Dockerfile`, `graph.py`, frontend components | Deployed to Cloud Run |

---

## Key Technical Concepts Learned

### LangGraph
- `StateGraph` — typed state machine; each node reads state and returns a _partial_ dict (only changed keys)
- `Annotated[list, add]` reducers — allows multiple nodes to append to the same list without overwriting
- `interrupt()` — pauses graph mid-execution for human input; graph checkpointed to `MemorySaver`
- `Command(resume=value)` — resumes a paused graph with human's input
- `MemorySaver` checkpointer — in-memory persistence of graph state between HTTP requests, keyed by `thread_id` (= `game_id`)
- Conditional edges with routing functions — enables the night→day→win-check→loop-back game cycle

### FastAPI + Pydantic v2
- Pydantic v2 response models for clean API contracts
- CORS middleware configuration for cross-origin frontend
- In-memory session store pattern (GAMES dict) for stateless-per-request server with stateful game sessions

### LangChain / Anthropic
- `ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)` — LLM client
- `SystemMessage` + `HumanMessage` pattern for structured prompts
- Lazy singleton instantiation to avoid multiple LLM client initializations
- JSON response parsing from LLM output (handling markdown code blocks wrapping JSON)

### React + TypeScript Frontend Architecture
- Custom hooks (`useGame`) for all game state management
- Polling pattern (`setInterval` on `GET /state`) as an alternative to WebSockets
- GSAP for all game animations — timelines, from/to tweens, stagger effects
- Howler.js for cross-browser audio management
- DaisyUI "night" theme as the design system base

### Information Security / Game Design
- Information isolation as an engineering constraint — `build_agent_view()` as a mandatory firewall between raw state and all participants
- Role-based knowledge restrictions enforced at the code layer, not the prompt layer
- Personality-driven NPC prompting to create diverse gameplay

---

## Project Repository

**GitHub:** `PasinduRavishan/Mafia` (deployment branch: `deployment`)  
**Backend:** Python 3.11 · FastAPI · LangGraph · LangChain (Anthropic)  
**Frontend:** React + TypeScript + Vite + Tailwind CSS + GSAP  
**Deployment:** Docker → Google Cloud Run  
**Observability:** LangSmith (`mafia-simulation` project) — traces every NPC agent call with game metadata
