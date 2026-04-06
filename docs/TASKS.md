# TASKS.md — Implementation Task List

> This is the live task tracker for Claude Code.
> Update status as tasks are completed. Never skip ahead — each phase depends on the previous.
> 
> **Status legend:** `[ ]` = not started · `[x]` = complete · `[~]` = in progress
>
> **CRITICAL DESIGN DECISION (2026-04-06):** This is a human-vs-LLM interactive game.
> ONE human player participates per game with a randomly assigned role.
> All other roles are LLM-powered NPCs. The human inputs statements and votes via CLI.
> Do NOT build a fully autonomous simulation — the human is always in the loop.

---

## Phase 1: Foundation (No LLM Required)

**Goal:** Build and fully test the pure Python foundation before any LLM code.

- [x] **1.1** Create project structure
  - Create all folders: `src/`, `src/nodes/`, `src/agents/`, `src/utils/`, `tests/`, `docs/`
  - Create empty `__init__.py` in each Python package folder
  - Create `.env.example` with required keys listed
  - Create `requirements.txt`
  - Commit: "chore: initial project structure"

- [x] **1.2** Implement `src/state.py`
  - Define `PlayerInfo` TypedDict
  - Define `NightActions` TypedDict
  - Define `GameState` TypedDict with ALL fields from ARCHITECTURE.md section 3
  - Include `human_player_id: PlayerID` field (always `"human"`)
  - Define type aliases: `PlayerID`, `Role`, `Alignment`
  - No business logic — just type definitions
  - Commit: "feat: define GameState schema"

- [x] **1.3** Implement `src/engine.py` — role assignment
  - `assign_roles(player_ids, config) -> dict[PlayerID, PlayerInfo]`
  - Randomly assigns roles based on config (num_mafia, has_detective, has_medic)
  - Randomly assigns personality to each player
  - Remaining players are villagers
  - Commit: "feat: engine - role assignment"

- [x] **1.4** Implement `src/engine.py` — night resolution
  - `resolve_night_actions(night_actions) -> Optional[PlayerID]`
  - Cross-save logic: if target == save → return None
  - Normal kill: return target
  - Commit: "feat: engine - night resolution"

- [x] **1.5** Implement `src/engine.py` — vote tallying
  - `tally_votes(votes) -> Optional[PlayerID]`
  - Counter-based majority detection
  - Return None on tie
  - Commit: "feat: engine - vote tallying"

- [x] **1.6** Implement `src/engine.py` — win check
  - `check_win_condition(alive_players) -> Optional[str]`
  - "village" if mafia_count == 0
  - "mafia" if mafia_count >= village_count
  - None if game continues
  - Commit: "feat: engine - win condition check"

- [x] **1.7** Implement `src/utils/state_views.py`
  - `build_agent_view(player_id, game_state) -> dict`
  - Strict filtering per role (see ARCHITECTURE.md section 5)
  - Mafia sees: teammates only
  - Detective sees: ledger only
  - Medic sees: self_heal_used only
  - Villager sees: nothing extra
  - All see: public_log, alive_players, round_number, own_role
  - Commit: "feat: state views - information isolation"

- [x] **1.8** Write and pass all tests in `tests/test_engine.py`
  - `test_cross_save` — no death when target == save
  - `test_normal_kill` — death when target != save
  - `test_no_mafia_action` — no death when mafia_target is None
  - `test_village_wins` — all mafia eliminated
  - `test_mafia_wins_equal` — 1 mafia vs 1 villager
  - `test_mafia_wins_majority` — 2 mafia vs 2 villagers
  - `test_tie_vote` — equal votes → None
  - `test_majority_vote` — clear winner
  - Commit: "test: all engine unit tests passing"

- [x] **1.9** Write and pass all tests in `tests/test_state_views.py`
  - `test_villager_cannot_see_roles`
  - `test_mafia_sees_only_teammates`
  - `test_detective_sees_only_ledger`
  - `test_mafia_cannot_see_detective_ledger`
  - `test_villager_cannot_see_mafia_teammates`
  - Commit: "test: information isolation tests passing"

**Phase 1 complete when:** All tests in test_engine.py and test_state_views.py pass with `pytest tests/` — no API keys needed.

---

## Phase 2: Graph Skeleton

**Goal:** Wire the LangGraph StateGraph with stub nodes. Verify graph compiles and runs.

- [ ] **2.1** Create stub node files
  - Create all 9 node files in `src/nodes/` (see ARCHITECTURE.md section 4)
  - Each stub: returns an empty dict `{}`
  - Just enough to import without errors
  - Commit: "feat: stub node files"

- [ ] **2.2** Implement `src/graph.py`
  - Full graph wiring from ARCHITECTURE.md section 4
  - `build_graph()` function returning compiled graph
  - `route_after_win_check()` routing function
  - Commit: "feat: graph wiring with stub nodes"

- [ ] **2.3** Verify graph compiles and visualizes
  - Run: `python -c "from src.graph import build_graph; g = build_graph(); print(g.get_graph().draw_mermaid())"`
  - Confirm Mermaid diagram shows correct node connections
  - Commit: "test: graph compiles successfully"

---

## Phase 3: Night Phase Nodes

**Goal:** Implement the three night phase agent nodes one by one.

- [ ] **3.1** Implement `src/agents/base_agent.py`
  - `call_agent(system_prompt, user_context) -> str`
  - Uses `ChatAnthropic(model="claude-sonnet-4-6")`
  - `format_context_for_prompt(context_dict) -> str` helper
  - Commit: "feat: base agent infrastructure"

- [ ] **3.2** Implement `src/nodes/setup_node.py`
  - Calls `engine.assign_roles()`
  - Initializes all GameState fields to starting values
  - Sets `game_id`, `round_number=1`, `phase="night"`, `discussion_turns_left` from config
  - Commit: "feat: setup node"

- [ ] **3.3** Implement `src/nodes/night_mafia_node.py`
  - Gets mafia player IDs from state
  - Calls `build_agent_view()` for mafia player
  - Uses Mafia Night Phase Prompt from AGENT_PROMPTS.md
  - Parses JSON response → sets `night_actions.mafia_target`
  - Validates target is alive and not self/teammate
  - Commit: "feat: mafia night node"

- [ ] **3.4** Implement `src/nodes/night_detective_node.py`
  - Gets detective player ID from state
  - Calls `build_agent_view()` for detective
  - Uses Detective Night Phase Prompt
  - Parses JSON response → sets `night_actions.detective_target`
  - Updates `detective_ledger` with true alignment of target
  - Commit: "feat: detective night node"

- [ ] **3.5** Implement `src/nodes/night_medic_node.py`
  - Gets medic player ID from state
  - Calls `build_agent_view()` for medic
  - Uses Medic Night Phase Prompt
  - Parses JSON response → sets `night_actions.medic_save`
  - Validates self-heal rule
  - Commit: "feat: medic night node"

- [ ] **3.6** Implement `src/nodes/resolve_night_node.py`
  - Calls `engine.resolve_night_actions()`
  - Updates `alive_player_ids`, `dead_player_ids`
  - Resets `night_actions` for next round
  - Commit: "feat: resolve night node"

- [ ] **3.7** Manual end-to-end test: Night phase
  - Run one full night phase (setup → mafia → detective → medic → resolve)
  - Check LangSmith dashboard: verify 3 agent calls are traced
  - Verify no information leaked between agents (check trace inputs)
  - Commit: "test: night phase e2e verified"

---

## Phase 4: Day Phase Nodes

**Goal:** Implement narrator, discussion, and vote nodes.

- [ ] **4.1** Implement `src/nodes/narrator_node.py`
  - Builds night result summary string
  - Uses Narrator Prompt from AGENT_PROMPTS.md
  - Appends narrator announcement to `public_log`
  - Commit: "feat: narrator node"

- [ ] **4.2** Implement `src/nodes/day_discussion_node.py`
  - Iterates over living players in order
  - For each: calls `build_agent_view()` + appropriate Day Phase Prompt
  - Appends statement to `day_statements` and `public_log`
  - Decrements `discussion_turns_left`
  - MUST check `discussion_turns_left > 0` before iterating
  - Commit: "feat: day discussion node"

- [ ] **4.3** Implement `src/nodes/vote_node.py`
  - For each living player: calls `build_agent_view()` + Vote Prompt
  - Collects all votes into `votes` dict
  - Calls `engine.tally_votes()` → sets `vote_result`
  - Updates alive/dead lists if vote_result is not None
  - Appends vote outcome to `public_log`
  - Commit: "feat: vote node"

- [ ] **4.4** Manual end-to-end test: Full round
  - Run setup → full night → full day → vote
  - Review LangSmith traces for all agent calls
  - Commit: "test: full round e2e verified"

---

## Phase 5: Game Loop

**Goal:** Wire win_check and complete full multi-round game.

- [ ] **5.1** Implement `src/nodes/win_check_node.py`
  - Calls `engine.check_win_condition()`
  - Sets `winner` and `game_over` in state if game ends
  - Returns routing key: "continue", "village_wins", or "mafia_wins"
  - Also checks `round_number >= max_rounds` → trigger draw/exit
  - Commit: "feat: win check node"

- [ ] **5.2** Run 5 complete game simulations
  - Create `run_game.py` script with `DEFAULT_CONFIG`
  - Run 5 games with `print` output of each round summary
  - Verify: both village wins and mafia wins occur across runs
  - Verify: max_rounds safety cutoff works
  - Commit: "test: full game simulations passing"

---

## Phase 6: Observability & Polish

- [ ] **6.1** Add LangSmith metadata to all nodes
  - Tags: phase name, round number
  - Metadata: game_id, alive count, round number
  - See ARCHITECTURE.md section 8

- [ ] **6.2** Add `tests/test_integration.py`
  - `test_game_completes_without_error` — runs one full game
  - `test_information_not_leaked` — verify no role leak in agent call inputs
  - These tests DO require API keys

- [ ] **6.3** Write `README.md`
  - Quick-start instructions
  - How to run a game
  - How to view traces in LangSmith

- [ ] **6.4** Final review
  - Re-read CLAUDE.md Definition of Done checklist
  - Verify all items are checked off
  - Commit: "docs: project complete"

---

## Notes for Claude Code

- Always commit after each task before moving to the next
- If a task requires reading a spec, reference the exact section: e.g., "see ARCHITECTURE.md section 5"
- If a test fails, fix it before moving to the next task — do not accumulate failing tests
- The `engine.py` functions must be pure Python with no side effects — easy to test
- Never import from `agents/` inside `engine.py` — the engine has zero LLM dependency
