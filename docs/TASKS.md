# TASKS.md — Implementation Task List

> Live task tracker for Claude Code.
> Never skip ahead — each phase depends on the previous.
>
> **Status legend:** `[ ]` = not started · `[x]` = complete · `[~]` = in progress
>
> **CRITICAL DESIGN DECISIONS:**
> - Human-vs-LLM interactive game. ONE human plays per game with a random role.
> - FastAPI backend + LangGraph interrupt pattern for human-in-the-loop.
> - React frontend planned for Phase 7 — game logic comes first.
> - Never commit — user handles all git operations.

---

## Phase 1: Foundation (No LLM) ✅ COMPLETE

- [x] **1.1** Create project structure
- [x] **1.2** Implement `src/state.py` — GameState, PlayerInfo, NightActions TypedDicts
- [x] **1.3** Implement `src/engine.py` — role assignment
- [x] **1.4** Implement `src/engine.py` — night resolution
- [x] **1.5** Implement `src/engine.py` — vote tallying
- [x] **1.6** Implement `src/engine.py` — win check
- [x] **1.7** Implement `src/utils/state_views.py` — build_agent_view() isolation
- [x] **1.8** 15 tests passing in `tests/test_engine.py`
- [x] **1.9** 10 tests passing in `tests/test_state_views.py`

**Result:** 25/25 tests passing. Zero API keys used.

---

## Phase 2: Graph Skeleton ✅ COMPLETE

- [x] **2.1** Create 9 stub node files in `src/nodes/`
- [x] **2.2** Implement `src/graph.py` — full StateGraph wiring + conditional edges
- [x] **2.3** Graph compiles and Mermaid diagram verified

---

## Phase 3: FastAPI Server

**Goal:** Running API server that manages game sessions and routes human input to LangGraph.
**Spec:** See `docs/API.md` for all endpoint details.

- [x] **3.1** Add FastAPI dependencies to `requirements.txt`
  - Add: `fastapi>=0.111.0`, `uvicorn>=0.30.0`
  - Run: `pip install -r requirements.txt`
  - Commit message: `"chore: add fastapi and uvicorn dependencies"`

- [x] **3.2** Create `api/` package structure
  - `api/__init__.py`
  - `api/main.py` — FastAPI app instance + CORS + router registration
  - `api/models.py` — Pydantic request/response models (see API.md)
  - `api/session.py` — in-memory GAMES dict + session helpers
  - `api/routes/__init__.py`
  - `api/routes/game.py` — route handlers (stub implementations)
  - Commit message: `"feat: fastapi package structure"`

- [x] **3.3** Implement `POST /game/start` (stub version)
  - Creates game_id (uuid4)
  - Calls `engine.assign_roles()` with "human" + generated player IDs
  - Initializes full GameState
  - Stores in GAMES session dict
  - Returns human's role view (no graph invocation yet — just state init)
  - Test: `curl -X POST http://localhost:8000/game/start -d '{"num_players": 6}'`
  - Commit message: `"feat: POST /game/start — session init"`

- [x] **3.4** Implement `GET /game/{game_id}/state`
  - Reads from GAMES dict
  - Returns `build_agent_view("human", state)` formatted as `GameStateResponse`
  - 404 if game not found
  - Commit message: `"feat: GET /game/state"`

- [x] **3.5** Implement `POST /game/{game_id}/action` (stub)
  - Validates game exists + waiting_for_human flag
  - Validates action type and value
  - Returns 409 if not waiting for human
  - Returns 400 if invalid target (dead player, self, etc.)
  - Does not yet resume graph — just validates and echoes
  - Commit message: `"feat: POST /game/action — validation stub"`

- [x] **3.6** Verify server runs cleanly
  - Run: `uvicorn api.main:app --reload`
  - Hit all 3 endpoints manually (curl or browser /docs)
  - Confirm Swagger UI at `http://localhost:8000/docs` shows all endpoints
  - Commit message: `"test: fastapi server running, all endpoints reachable"`

---

## Phase 4: Night Phase Agents + Graph Integration

**Goal:** Real LangGraph execution with NPC agents and human interrupt for night actions.

- [x] **4.1** Implement `src/agents/base_agent.py`
  - `call_agent(system_prompt, user_context) -> str`
  - Uses `ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)`
  - `format_context_for_prompt(context_dict) -> str` helper
  - Commit message: `"feat: base agent infrastructure"`

- [x] **4.2** Implement `src/nodes/setup_node.py` (full implementation)
  - Calls `engine.assign_roles()`
  - Initializes all GameState fields: round_number=1, phase="night", empty logs, etc.
  - Sets discussion_turns_left from config
  - Commit message: `"feat: setup node — full implementation"`

- [x] **4.3** Implement `src/nodes/night_mafia_node.py`
  - Gets mafia player(s) from state
  - If human is mafia → `interrupt(build_agent_view("human", state))` → return on resume
  - If NPC mafia → call LLM with Mafia Night Prompt → parse JSON target
  - Validates target: alive, not self, not teammate
  - Returns `{"night_actions": updated}`
  - Commit message: `"feat: mafia night node"`

- [x] **4.4** Implement `src/nodes/night_detective_node.py`
  - If human is detective → interrupt → resume with their target
  - If NPC → LLM call with Detective Night Prompt → parse JSON
  - Updates `detective_ledger` with true alignment of target
  - Commit message: `"feat: detective night node"`

- [x] **4.5** Implement `src/nodes/night_medic_node.py`
  - If human is medic → interrupt → resume with their save target
  - If NPC → LLM call with Medic Night Prompt → parse JSON
  - Validates self-heal rule
  - Commit message: `"feat: medic night node"`

- [x] **4.6** Implement `src/nodes/resolve_night_node.py`
  - Calls `engine.resolve_night_actions()`
  - Updates `alive_player_ids`, `dead_player_ids`
  - Resets `night_actions` for next round
  - Commit message: `"feat: resolve night node"`

- [x] **4.7** Wire graph execution into `POST /game/start`
  - Use `MemorySaver` checkpointer
  - Call `graph.invoke(initial_state, config)` on game start
  - Graph runs until first interrupt (human's turn) or day phase begins
  - `POST /game/start` response now includes real `prompt` from interrupt payload
  - Commit message: `"feat: graph execution wired into /game/start"`

- [x] **4.8** Wire `POST /game/{id}/action` to resume graph
  - On valid action → `graph.invoke(Command(resume=value), config)`
  - Graph runs until next interrupt or end
  - Return updated state + next prompt
  - Commit message: `"feat: /game/action resumes langgraph"`

- [~] **4.9** Manual test: full night phase via API
  - Start game, get role, play through one full night via curl/Postman
  - Check LangSmith: verify NPC agent calls are traced
  - Verify no role info leaked in any NPC prompt (check trace inputs)
  - Commit message: `"test: night phase e2e via API"`

---

## Phase 5: Day Phase

**Goal:** Narrator announcement, NPC discussion, human statement, voting.

- [ ] **5.1** Implement `src/nodes/narrator_node.py`
  - Builds night result string from state
  - LLM call with Narrator Prompt (see AGENT_PROMPTS.md)
  - Appends announcement to `public_log`
  - Commit message: `"feat: narrator node"`

- [ ] **5.2** Implement `src/nodes/day_discussion_node.py`
  - Iterates living players in order
  - Checks `discussion_turns_left > 0` — if 0, skip to vote
  - For each NPC → LLM call with appropriate Day Prompt
  - For human → `interrupt(agent_view)` → resume with their statement
  - Appends each statement to `day_statements` + `public_log`
  - Decrements `discussion_turns_left`
  - Commit message: `"feat: day discussion node"`

- [ ] **5.3** Implement `src/nodes/vote_node.py`
  - Each living NPC → LLM call with Vote Prompt → parse JSON vote
  - Human → `interrupt(agent_view)` → resume with their vote target
  - Calls `engine.tally_votes()` → sets `vote_result`
  - Updates alive/dead lists
  - Appends outcome to `public_log`
  - Commit message: `"feat: vote node"`

- [ ] **5.4** Manual test: full round via API
  - Play through setup → night → day discussion → vote via curl/Postman
  - Review NPC statements for quality and information isolation
  - Commit message: `"test: full round e2e via API"`

---

## Phase 6: Full Game Loop

**Goal:** Complete multi-round games with win conditions.

- [ ] **6.1** Implement `src/nodes/win_check_node.py`
  - Calls `engine.check_win_condition()`
  - Sets `winner` + `game_over` in state
  - Also checks `round_number >= max_rounds` (safety cutoff, default 20)
  - Returns routing key to `route_after_win_check()`
  - Commit message: `"feat: win check node"`

- [ ] **6.2** Reset state between rounds
  - After win_check routes "continue" → reset: `night_actions`, `day_statements`, `votes`, `discussion_turns_left`
  - Increment `round_number`
  - This happens in setup for round 1; a `reset_round_node` or inline in win_check for subsequent rounds
  - Commit message: `"feat: round reset between loops"`

- [ ] **6.3** Play 3 complete games via API
  - Use a test script `scripts/test_game.py` that drives the API automatically
  - Verify mafia wins and village wins both occur
  - Verify max_rounds cutoff works
  - Commit message: `"test: full game loop verified"`

- [ ] **6.4** Add `tests/test_integration.py`
  - `test_game_starts_and_returns_role` — no LLM, just session init
  - `test_invalid_action_rejected` — dead player target → 400
  - `test_game_not_found` — bad game_id → 404
  - Commit message: `"test: integration tests passing"`

---

## Phase 7: Frontend (React)

**Goal:** Web UI consuming the FastAPI backend. Complete game experience.

- [ ] **7.1** Scaffold React + TypeScript + Tailwind project in `frontend/`
  - `npx create-react-app frontend --template typescript` or Vite
  - Commit message: `"chore: scaffold react frontend"`

- [ ] **7.2** Start screen
  - Player count selector + "Start Game" button
  - Calls `POST /game/start`
  - Shows role reveal screen with flavor text

- [ ] **7.3** Night phase UI
  - Shows human's filtered view (alive players, public log)
  - If human has night action → shows target picker
  - While NPCs are acting → loading spinner + "Waiting for night to pass..."

- [ ] **7.4** Day phase UI
  - Shows NPC statements as they appear in public_log
  - Text input for human's statement
  - Voting UI — clickable player cards

- [ ] **7.5** Game over screen
  - Winner announcement with flavor text
  - Role reveal for all players
  - "Play again" button

---

## Phase 8: Observability & Polish

- [ ] **8.1** Add LangSmith metadata to all nodes
  - Tags: phase name, round number
  - Metadata: game_id, alive_count, round

- [ ] **8.2** Error handling pass
  - Wrap all LLM calls in try/except — fallback if JSON parse fails
  - Handle disconnected clients gracefully

- [ ] **8.3** Write README.md
  - How to install + run the backend
  - How to run the frontend
  - How to view LangSmith traces

- [ ] **8.4** Final review against CLAUDE.md Definition of Done

---

## Notes

- Always activate venv: `source .venv/bin/activate`
- Run tests: `.venv/bin/python -m pytest tests/`
- Run server: `uvicorn api.main:app --reload`
- LangSmith traces at: https://smith.langchain.com
- User handles all git commits and pushes — Claude does not run git commit
