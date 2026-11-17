# Project Work Documentation — Mafia Interactive Game

**Project:** Mafia Interactive Human-vs-LLM Game
**Tech Stack:** Python 3.11 · FastAPI · LangGraph · LangChain (Anthropic Claude) · LangSmith · React · TypeScript · Tailwind CSS · GSAP · Docker · Google Cloud Run

---

## Project Overview

Built a complete, production-deployed, full-stack implementation of the social deduction game **Mafia** from scratch. The system allows one human player to compete against multiple LLM-powered NPC agents driven by Anthropic's Claude Sonnet model. The human is randomly assigned one of four roles — Mafia, Detective, Medic, or Villager — and plays alongside AI opponents who autonomously handle every other role.

The project was built spec-first: all architecture documents, game rules, API contracts, agent prompt templates, and task plans were written before any code. This approach, called **spec-driven development**, ensured every implementation decision was grounded in a written specification.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│  React + TypeScript Frontend (SPA)                  │
│  LandingScreen · RoleReveal · GameScreen · GameOver │
│  GSAP animations · Howler.js audio · tsParticles    │
└────────────────────┬────────────────────────────────┘
                     │ HTTP polling (REST API)
┌────────────────────▼────────────────────────────────┐
│  FastAPI Backend                                     │
│  POST /game/start                                   │
│  GET  /game/{id}/state                              │
│  POST /game/{id}/action                             │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  LangGraph StateGraph — Game Orchestration Engine   │
│  9 nodes → interrupt() for human turns              │
│  MemorySaver / PostgresSaver checkpointer           │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  NPC Agents (Claude claude-sonnet-4-6)              │
│  Mafia · Detective · Medic · Villager               │
│  Each receives only build_agent_view() filtered state│
└─────────────────────────────────────────────────────┘
```

---

## Part 1 — Game Data Model (`src/state.py`)

Designed and implemented the entire game's data schema as a single Python `TypedDict` called `GameState`. Every piece of game data flows through this typed structure.

### TypedDict Classes Built

**`PlayerInfo`** — one record per player (human or NPC):
- `player_id` — unique string identifier (e.g. `"human"`, `"Alice"`, `"Bob"`)
- `role` — one of `"mafia"`, `"detective"`, `"medic"`, `"villager"`
- `alignment` — `"mafia"` or `"village"` (two Mafia members have different roles but same alignment)
- `personality` — one of `"aggressive"`, `"defensive"`, `"analytical"` (shapes LLM dialogue style)
- `is_alive` — boolean flag, updated by night resolution and vote outcomes
- `is_human` — boolean flag, used by all nodes to decide interrupt vs. LLM call

**`NightActions`** — collects all three night role decisions:
- `mafia_target` — player_id the Mafia chose to kill (or `None`)
- `detective_target` — player_id the Detective investigated (or `None`)
- `medic_save` — player_id the Medic chose to protect (or `None`)
- Reset to all-`None` at the start of every new round

**`GameState`** — the central state object that the LangGraph passes between every node:

| Field | Type | Purpose |
|-------|------|---------|
| `all_players` | `dict[PlayerID, PlayerInfo]` | Full roster including private roles — never exposed directly to agents |
| `game_id` | `str` | UUID4 — used as LangGraph thread ID and LangSmith trace key |
| `human_player_id` | `str` | Always `"human"` — tells nodes which player is the human |
| `alive_player_ids` | `list[str]` | Authoritative alive list — updated after each death |
| `dead_player_ids` | `Annotated[list, add]` | Accumulates deaths across all rounds via LangGraph reducer |
| `round_number` | `int` | Increments each time win_check routes "continue" |
| `phase` | `Literal[...]` | Current game phase for API responses and routing |
| `night_actions` | `NightActions` | Current round's night decisions |
| `public_log` | `Annotated[list[str], add]` | Everything all players can see — appended by every node, never overwritten |
| `day_statements` | `list[dict]` | `{player_id, statement}` for the current round's discussion |
| `discussion_turns_left` | `int` | Countdown — prevents infinite discussion loops |
| `votes` | `dict[str, str]` | `voter_id → voted_for_id` for the current round |
| `vote_result` | `Optional[str]` | Who was eliminated by vote (`None` on tie) |
| `detective_ledger` | `dict[str, str]` | Detective's private investigation records — persists across rounds |
| `medic_self_heal_used` | `bool` | Tracks the once-per-game self-heal rule |
| `winner` | `Optional[str]` | `"village"` or `"mafia"` — set by win_check_node |
| `game_over` | `bool` | Graph routing flag — triggers END when True |

**Key LangGraph design decision:** Fields that accumulate across rounds use `Annotated[list, add]` as their type. This tells LangGraph's reducer to _append_ new items rather than overwrite — so multiple nodes can safely add to `public_log` and `dead_player_ids` without conflicts.

---

## Part 2 — Game Engine (`src/engine.py`)

Implemented all game logic as pure Python functions with zero LLM calls. This was a deliberate separation of concerns: game rules are deterministic and testable without any API keys.

### `assign_roles(player_ids, config) → dict[PlayerID, PlayerInfo]`
- Accepts the full list of player IDs (including `"human"`) and a config dict
- Config keys: `num_mafia`, `has_detective`, `has_medic`
- Builds the roles list (Mafia × n, plus Detective, Medic, and remaining Villagers)
- Shuffles `player_ids` randomly before assigning — ensures no predictable role ordering
- Randomly assigns one of three personalities (`aggressive`, `defensive`, `analytical`) to each player
- Returns a fully populated `dict[PlayerID, PlayerInfo]` with all players marked `is_alive=True`

### `resolve_night_actions(night_actions) → Optional[PlayerID]`
- Implements the **cross-save rule**: if `mafia_target == medic_save`, returns `None` (no death)
- If `mafia_target` is `None` (mafia didn't act), returns `None`
- Otherwise returns `mafia_target` as the player who died
- This function is called by `resolve_night_node.py` — never by any LLM

### `tally_votes(votes) → Optional[PlayerID]`
- Counts votes using `collections.Counter`
- Returns the player with the most votes
- Returns `None` on a **tie** (two players receive equal top votes) — no elimination
- Returns `None` on empty votes dict — no elimination

### `check_win_condition(alive_players) → Optional[str]`
- Counts `mafia_count` and `village_count` from the alive players dict
- Returns `"village"` if `mafia_count == 0` (all Mafia eliminated)
- Returns `"mafia"` if `mafia_count >= village_count` (Mafia equals or outnumbers village — e.g. 1 Mafia vs 1 Villager = Mafia win)
- Returns `None` if game continues

---

## Part 3 — Information Isolation Layer (`src/utils/state_views.py`)

The most critical security constraint in the project. **No player — human or LLM — ever receives the raw `GameState`.** Every participant receives only what their role is entitled to see.

### `build_agent_view(player_id, state) → dict`

The sole function in this module. Called before every LLM invocation and every `interrupt()` call for the human.

**Base view (all roles receive):**
- `your_player_id`, `your_role`, `your_personality`, `is_human`
- `round_number`, `alive_players`, `public_log`, `day_statements`

**Mafia only receives additionally:**
- `mafia_teammates` — list of other Mafia player IDs (excluding self)
- Does NOT receive: detective_ledger, other players' roles, medic information

**Detective only receives additionally:**
- `investigation_ledger` — their own private records of investigations conducted so far
- Does NOT receive: mafia_teammates, other players' roles

**Medic only receives additionally:**
- `medic_self_heal_used` — boolean flag so they know if their once-per-game self-heal is available
- Does NOT receive: detective_ledger, mafia_teammates, other players' roles

**Villager receives only the base view** — no private knowledge whatsoever.

This function runs identically for human and NPC players. The human's filtered view is what gets sent back to the frontend via the API.

---

## Part 4 — LangGraph Graph (`src/graph.py`)

Designed and implemented the full game state machine using LangGraph's `StateGraph`.

### Graph Topology

```
START
  │
  ▼
[setup_node]           → Assigns roles, builds initial state, writes opening log
  │
  ▼
[night_mafia_node]     → Mafia picks kill target (LLM or human interrupt)
  │
  ▼
[night_detective_node] → Detective investigates one player (LLM or human interrupt)
  │
  ▼
[night_medic_node]     → Medic picks one player to protect (LLM or human interrupt)
  │
  ▼
[resolve_night_node]   → Pure Python: compare target vs save → update alive/dead
  │
  ▼
[narrator_node]        → LLM writes dramatic night announcement
  │
  ▼
[day_discussion_node]  → All players speak (NPC LLM calls + human interrupt)
  │
  ▼
[vote_node]            → All players vote (NPC LLM calls + human interrupt)
  │
  ▼
[win_check_node]       → Checks win condition → routes:
                            "continue"     → back to night_mafia_node
                            "village_wins" → END
                            "mafia_wins"   → END
```

### Checkpointer (State Persistence)

The graph is compiled with a checkpointer that stores state between HTTP requests. Two checkpointer modes are supported:

- **`MemorySaver`** — in-memory, used for local development. Each game session is keyed by `game_id` as the `thread_id`.
- **`PostgresSaver`** — persistent database backend for production/Cloud Run. Uses a lazy connection pool (`min_size=0`) to handle Neon serverless cold starts safely (connections open on first use, not at pool creation).

Auto-detection: if `DATABASE_URL` env var is set, attempts Postgres; falls back to MemorySaver on failure.

### Routing Function

```python
def route_after_win_check(state: GameState) -> str:
    if state.get("game_over"):
        return "village_wins" if state.get("winner") == "village" else "mafia_wins"
    return "continue"
```

---

## Part 5 — Night Phase Nodes

### `setup_node.py`
- Calls `engine.assign_roles()` with the player list and config
- Initializes all GameState fields to starting values
- Writes opening public log entries
- Sets `discussion_turns_left` from config (default: 1)
- Sets `round_number = 1`, `phase = "night"`, all action fields to `None`

### `night_mafia_node.py`
**Human path:** Calls `interrupt({type: "night_action", message: ..., options: valid_targets})` which pauses graph execution. FastAPI returns this payload to the frontend. When the human submits a target via `POST /game/{id}/action`, graph resumes with their choice.

**NPC path:**
1. Calls `build_agent_view(mafia_id, state)` to get the Mafia's filtered view
2. Formats `MAFIA_NIGHT_PROMPT` with the view data (injects only last 10 public log entries to save tokens)
3. Calls `call_agent(prompt, view)` → Claude returns JSON
4. Calls `parse_json_response()` to extract `{"target": "...", "reasoning": "..."}`
5. Validates target is alive and not a Mafia teammate; falls back to random valid target if LLM returns bad JSON or invalid player

Returns: `{"night_actions": updated_NightActions, "public_log": [log lines]}`

### `night_detective_node.py`
Same pattern as Mafia node. Detective's view includes their `investigation_ledger`. After choosing a target to investigate, the node looks up the target's true `alignment` in `state["all_players"]` and appends `{target_id: alignment}` to `detective_ledger`. This ledger persists across all rounds and is only ever visible to the Detective.

### `night_medic_node.py`
Same pattern. Medic's view includes `medic_self_heal_used` so the LLM knows if self-protection is available. Node validates the `allow_medic_self_heal` rule before accepting a self-target.

### `resolve_night_node.py`
Pure Python — no LLM call.
1. Calls `engine.resolve_night_actions(state["night_actions"])`
2. If result is `None` (cross-save or no Mafia action) → logs "No one was found dead this morning"
3. If result is a `player_id` → marks that player as dead in `alive_player_ids`, `dead_player_ids`, and `all_players[pid]["is_alive"] = False`
4. Writes a `__night_result__:` marker line to `public_log` (an internal marker stripped by the API before sending to the frontend, used by the narrator node to know what happened)

---

## Part 6 — Day Phase Nodes

### `narrator_node.py`
- Reads the night result marker from `public_log` to know if anyone died
- Builds context: who died (if anyone), their role (revealed on death), what round it is
- Calls LLM with `NARRATOR_PROMPT` — the narrator speaks in a dramatic, story-flavored style (think horror-game announcer)
- Two scenarios:
  - **Someone died:** "The villagers gather in the town square. [Player X] was found dead at dawn. Their role is revealed as [role]."
  - **Cross-save:** "The village wakes to an eerie silence. No one was found dead this morning."
- Appends narrator announcement to `public_log`

### `day_discussion_node.py`
**Design choice:** NPCs speak first (in alive player order), human speaks last. This gives the human maximum information before committing to their statement.

**For each NPC player:**
1. Calls `build_agent_view(pid, state)` → filtered view
2. Selects the appropriate day prompt template based on role (Mafia/Detective/Medic/Villager each have different templates)
3. Formats prompt with player's view data, injects last 15 public log entries and all current day statements
4. Calls `call_agent()` → 2–4 sentence dialogue statement
5. Appends `{player_id, statement}` to `day_statements` and `[player_id]: statement` to `public_log`

**For human player:**
- Calls `interrupt({type: "day_statement", message: context_summary, npc_statements: already_spoken})`
- `npc_statements` is passed so the frontend can animate each NPC statement appearing before showing the human's text input
- On resume, appends the human's statement to `day_statements` and `public_log`

**Bounds check:** If `discussion_turns_left <= 0`, skips immediately to `{"phase": "vote"}` — prevents infinite loops.

Returns updated `day_statements`, appended `public_log`, decremented `discussion_turns_left`, and `phase = "vote"`.

### `vote_node.py`
**Design choice:** NPC votes run first via LLM before the human interrupt. When the human's turn arrives, all NPC votes are already tallied — the frontend can show a sequential vote ceremony (each NPC card flips to reveal their vote) before asking the human to cast theirs.

**`_role_hint(player_id, state)` helper:**
- Mafia: "Do NOT vote for your teammate(s). Vote for an innocent."
- Detective: If ledger has confirmed Mafia, "Vote for [confirmed Mafia player]." Otherwise uses public log reasoning.
- Medic/Villager: "Use day statements and public log to decide."

**For each NPC:**
1. Calls `call_agent()` with `VOTE_PROMPT` including the role-specific hint
2. Parses JSON `{"vote": "player_id"}`
3. Validates target is alive and not self; falls back to random alive player on failure
4. Logs vote immediately to `vote_log_lines`

**Human interrupt:** Passes `npc_votes` dict so frontend receives all NPC votes at interrupt time. Human casts final vote.

**Tally:** Calls `engine.tally_votes(votes)` on the full combined votes dict.
- If someone is eliminated → updates `alive_player_ids`, `dead_player_ids`, `all_players[pid]["is_alive"]`, logs role reveal
- If tie → logs "The vote is tied. No one is eliminated."

### `win_check_node.py`
Called after every vote phase.

1. Builds `alive` dict from `alive_player_ids` (not `all_players.is_alive` — avoids stale state)
2. Calls `engine.check_win_condition(alive)`
3. **Village wins:** `game_over=True`, `winner="village"`, `phase="ended"`, routes to END
4. **Mafia wins:** `game_over=True`, `winner="mafia"`, `phase="ended"`, routes to END
5. **Safety cutoff:** `round_number >= MAX_ROUNDS (20)` → `game_over=True`, `winner=None` (draw), routes to END
6. **Game continues:** Resets `night_actions`, `votes`, `vote_result`, `day_statements`, `discussion_turns_left = 1`; increments `round_number`; sets `phase="night"`; routes back to `night_mafia_node`

---

## Part 7 — LLM Agent Infrastructure (`src/agents/base_agent.py`)

### Multi-provider LLM Architecture
Built with a swappable provider system — a single `LLM_PROVIDER` constant controls which LLM backend is used. Supported providers:
- `"claude"` → `ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)`
- `"gemini"` → `ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.8)`
- `"groq"` → `ChatGroq(model="llama-3.3-70b-versatile", temperature=0.8)`

Uses a **lazy singleton pattern** (`_llm = None` → initialized on first `_get_llm()` call) to avoid re-instantiating the LLM client on every request.

### `call_agent(system_prompt, user_context, max_retries=3) → str`
- Serializes `user_context` dict via `format_context_for_prompt()`
- Wraps in `[SystemMessage(content=prompt), HumanMessage(content=context)]` structure
- **Retry logic with exponential backoff:** catches overload/rate-limit errors (`529`, `429`, `503`, `resource_exhausted`); waits 6s → 12s → 18s between attempts; resets the singleton on each retry to get a fresh connection
- Raises on non-retriable errors immediately

### `format_context_for_prompt(context) → str`
- Converts the filtered agent view dict to a structured plain-text block
- Formats lists as comma-separated strings, dicts as `key=value` pairs
- Strips the `is_human` key (internal only, not meaningful to the LLM)
- Prefixes each key with `KEY_NAME:` for clear LLM parsing

### `parse_json_response(response) → dict`
Three-stage JSON extraction (handles all LLM output formats):
1. Direct `json.loads()` — works when LLM returns clean JSON
2. Regex extraction from `\`\`\`json ... \`\`\`` code fences — handles LLM markdown wrapping
3. Regex extraction of first `{...}` block — fallback for mixed text/JSON responses
4. Raises `ValueError` with response preview if all three fail

---

## Part 8 — Agent Prompt Templates (`src/utils/prompts.py`)

Wrote six role-specific LLM prompt templates. All use Python f-string format placeholders that are filled with values from `build_agent_view()` at runtime.

### `MAFIA_NIGHT_PROMPT`
- System: You are Mafia. Your goal is to eliminate villagers without being caught.
- Injects: `your_player_id`, `mafia_teammates`, `round_number`, `alive_players`, last 10 `public_log` entries, `your_personality`
- Personality instructions: aggressive → bold targeting; defensive → strategic threat elimination; analytical → prioritise Detective/Medic
- Returns: `{"target": "player_id", "reasoning": "..."}`

### `DETECTIVE_NIGHT_PROMPT`
- System: You are the Detective. Identify Mafia at night. Guide village subtly during day. Do NOT reveal your role.
- Injects: `your_player_id`, `investigation_ledger`, `round_number`, `alive_players`, `public_log`
- Returns: `{"target": "player_id", "reasoning": "..."}`

### `MEDIC_NIGHT_PROMPT`
- System: You are the Medic. Protect the player you think Mafia will target.
- Injects: `medic_self_heal_used`, `round_number`, `alive_players`, `public_log`
- Returns: `{"save": "player_id", "reasoning": "..."}`

### `MAFIA_DAY_PROMPT` / `VILLAGER_DAY_PROMPT` / `DETECTIVE_DAY_PROMPT` / `MEDIC_DAY_PROMPT`
- Four separate day discussion prompts — each role is instructed to speak naturally as their character
- Mafia: deflect suspicion, sow doubt about innocent players
- Detective: guide village subtly without revealing identity
- Medic: contribute to discussion without exposing their protective role
- Villager: reason from public log, accuse suspicious players
- All injects: `your_player_id`, `your_personality`, `round_number`, `alive_players`, `public_log`, `day_statements`
- Returns: free-text dialogue (2–4 sentences)

### `VOTE_PROMPT`
- Injects: `your_player_id`, `your_role`, `vote_options`, `public_log`, `day_statements`, `role_hint` (role-specific voting guidance)
- Returns: `{"vote": "player_id", "reasoning": "..."}`

### `NARRATOR_PROMPT`
- Third-person dramatic announcer voice
- Injects: night result (death or cross-save), round number
- Returns: 2–3 sentences of atmospheric narration

---

## Part 9 — FastAPI Backend (`api/`)

### `api/session.py`
- `GameSession` class: stores `game_id`, `state`, `waiting_for_human`, `pending_prompt`
- Global `GAMES: dict[str, GameSession]` in-memory store (one entry per active game)
- `create_session(game_id, initial_state) → GameSession`
- `get_session(game_id) → Optional[GameSession]`

### `api/models.py` (Pydantic v2 Schemas)

**Request schemas:**
- `StartGameRequest` — `num_players: int` (4–10, default 6)
- `ActionRequest` — `type: Literal["night_action", "day_statement", "vote"]` + `value: str`

**Response schemas:**
- `PromptPayload` — `type`, `message`, `options` (player ID list for pick actions, `None` for free text), `npc_votes` (all NPC votes before human interrupt), `npc_statements` (all NPC statements before human interrupt)
- `GameStateResponse` — full filtered state: `game_id`, `round_number`, `phase`, `alive_players`, `dead_players`, `public_log`, `day_statements`, `prompt`, `game_over`, `winner`, `your_role`, and three role-specific optional fields (`mafia_teammates`, `investigation_ledger`, `medic_self_heal_used`)

### `api/routes/game.py`

**Thread pool execution:** LangGraph graph invocations (`graph.invoke()`) are synchronous and blocking (they run LLM calls that take 1–5 seconds). A `ThreadPoolExecutor(max_workers=4)` is used with `asyncio.run_in_executor()` to run them off FastAPI's async event loop without blocking other requests.

**Lazy graph singleton:** The compiled `StateGraph` is expensive to build (it runs checkpointer setup). Built once on first request, reused for all subsequent requests.

**NPC name pool:** 15 human-sounding names shuffled each game (Alice, Bob, Carlos, Diana, etc.) — makes the game feel personal rather than `player_1`, `player_2`.

**`_get_interrupt_payload(game_id) → Optional[dict]`:**
- Reads `graph.get_state(config)` to get the current checkpoint snapshot
- Checks `snapshot.next` — non-empty means the graph is paused
- Iterates `snapshot.tasks[].interrupts[]` to extract the `interrupt()` payload dict
- Returns `None` if graph ran to completion or is between turns

**`_get_current_state(game_id) → Optional[GameState]`:**
- Reads `graph.get_state(config).values` — always the latest checkpointed state
- Used as the source of truth for all API responses

**`_build_response(session) → GameStateResponse`:**
- Reads current state from checkpointer
- Calls `build_agent_view("human", state)` to get the filtered human view
- Checks for active interrupt payload → builds `PromptPayload` or sets `waiting_for_human=False`
- Strips `__night_result__:` internal marker lines from `public_log` before sending to client
- Returns fully populated `GameStateResponse`

### `POST /game/start`
1. Generates `game_id = uuid4()`
2. Samples NPC names from name pool, builds player list `["human"] + npc_names`
3. Calls `engine.assign_roles()` → `all_players`
4. Builds complete `initial_state` GameState with all fields initialized
5. Calls `loop.run_in_executor(_executor, lambda: graph.invoke(initial_state, config))`
6. Graph runs `setup_node` → night nodes until first human interrupt (or through night if human has no night action)
7. Returns `_build_response(session)` — includes the first prompt the human must answer

### `GET /game/{game_id}/state`
- Reads current state from checkpointer, returns filtered response
- Used by frontend polling (every 1.5 seconds) while NPC turns are running
- Returns 404 if game not found

### `POST /game/{game_id}/action`
1. Reads current interrupt payload → 409 if not waiting for human
2. Validates the submitted value:
   - For `night_action` and `vote`: target must be in `alive_player_ids`, cannot be `"human"` (self-vote)
   - For `day_statement`: value cannot be empty string
3. Calls `graph.invoke(Command(resume=value), config)` in thread pool
4. Graph resumes from the exact interrupt point, runs NPC turns until next interrupt or END
5. Returns updated `_build_response(session)` — includes next prompt or game_over state

---

## Part 10 — Test Suite (`tests/`)

All tests run without any LLM calls or API keys required.

### `tests/test_engine.py` — 15 tests for game logic

**Night resolution tests:**
- `test_cross_save()` — Mafia targets p2, Medic saves p2 → `None` (no death)
- `test_normal_kill()` — Mafia targets p2, Medic saves p3 → `"p2"` dies
- `test_no_mafia_action()` — `mafia_target=None` → `None`
- `test_no_medic_action()` — Mafia targets p2, no save → `"p2"` dies

**Vote tally tests:**
- `test_tie_vote()` — equal vote counts → `None`
- `test_majority_vote()` — p3 gets 2 votes, p4 gets 1 → `"p3"`
- `test_empty_votes()` — empty dict → `None`
- `test_single_vote()` — one voter → that target eliminated

**Win condition tests:**
- `test_village_wins()` — 0 mafia alive → `"village"`
- `test_mafia_wins_equal()` — 1 mafia vs 1 villager → `"mafia"`
- `test_mafia_wins_majority()` — 2 mafia vs 2 villagers → `"mafia"`
- `test_game_continues()` — 1 mafia vs 3 villagers → `None`

**Role assignment tests:**
- `test_assign_roles_counts()` — role counts match config exactly
- `test_assign_roles_human_flag()` — `"human"` has `is_human=True`, all others `False`
- `test_assign_roles_all_alive()` — all players start `is_alive=True`

### `tests/test_state_views.py` — 10 tests for information isolation

- `test_villager_cannot_see_roles()` — no `mafia_teammates`, `investigation_ledger`, or `medic_self_heal_used` in villager view
- `test_villager_sees_public_info()` — villager sees `your_role`, `alive_players`, `public_log`
- `test_mafia_sees_only_teammates()` — Mafia gets `mafia_teammates`, no ledger, no medic info
- `test_mafia_cannot_see_detective_ledger()` — ledger absent from Mafia view
- `test_mafia_teammates_excludes_self()` — own player ID never in `mafia_teammates`
- `test_detective_sees_only_ledger()` — detective gets `investigation_ledger`, no Mafia teammates
- `test_detective_ledger_contents()` — ledger values match what was set in state
- `test_medic_sees_self_heal_flag()` — medic gets `medic_self_heal_used`
- `test_medic_cannot_see_detective_ledger()` — ledger absent from medic view
- `test_villager_cannot_see_mafia_teammates()` — teammates field absent from villager view

**Result: 25/25 tests pass. No API keys required.**

---

## Part 11 — Automated Test Script (`scripts/test_game.py`)

A 251-line script that drives a complete Mafia game via the HTTP API with no human input required. Used to verify the full game loop end-to-end.

**What it does:**
1. Calls `POST /game/start` to initialize a new game
2. Reads the returned `prompt` to know what type of action is expected
3. Auto-generates a valid response:
   - Night action / vote → picks a random valid option from `prompt.options`
   - Day statement → generates a placeholder statement string
4. Calls `POST /game/{id}/action` and loops until `game_over=True`
5. Prints a complete game transcript showing every prompt and action

**Verified during testing:**
- Both "village wins" and "mafia wins" outcomes are reachable
- The cross-save scenario (Medic saves Mafia's target) results in "No one died"
- Tie votes result in no elimination and game continuing
- The `round_number >= 20` safety cutoff terminates the game as a draw
- Detective's `investigation_ledger` correctly accumulates across rounds
- Dead players are never included in `alive_player_ids` in subsequent rounds

---

## Part 12 — React Frontend (`frontend/`)

Built a complete, cinematic web application in React + TypeScript consuming the FastAPI backend. The entire frontend is a single-page application (SPA) with no server-side rendering.

### Design System

**Color palette:**
```css
--bg:       #0d0d0d   /* near-black background */
--card:     #1a1a2e   /* dark navy card surfaces */
--accent:   #e8a838   /* lantern amber — primary CTAs and glows */
--mafia:    #c0392b   /* blood red — Mafia role theming */
--detective:#2980b9   /* midnight blue — Detective role theming */
--medic:    #27ae60   /* forest green — Medic role theming */
--villager: #7f8c8d   /* muted grey — Villager role theming */
--text:     #e8e8e8   /* off-white body text */
--muted:    #4a4a5a   /* dimmed elements */
```

**Fonts:** Cinzel Decorative (game title, phase headers), Lora (narrator speech — serif, atmospheric), Inter (UI chrome, buttons, labels), JetBrains Mono (game log panel — terminal feel).

**Base theme:** DaisyUI v4 "night" dark theme, overridden with custom CSS variables where needed.

### State & API Layer

**`src/types/game.ts`** — TypeScript interfaces mirroring backend Pydantic models:
- `PromptPayload`, `GameStateResponse`, `StartGameRequest`, `ActionRequest`
- `npc_votes: Record<string, string>` for vote ceremony data
- `npc_statements: Array<{player_id: string, statement: string}>` for discussion animation

**`src/api/client.ts`** — Axios-based API client:
- `api.startGame(req)` → `POST /game/start`
- `api.getState(gameId)` → `GET /game/{id}/state`
- `api.submitAction(gameId, req)` → `POST /game/{id}/action`
- Base URL configured via `VITE_API_URL` env var (supports both local dev and deployed backend)

**`src/hooks/useGame.ts`** — Core state management hook:
- `useState` for `screen`, `gameState`, `loading`, `error`
- `startPolling(gameId)` — starts a 1.5s interval calling `getState()`; stops automatically when `state.prompt` or `state.game_over` is received
- `stopPolling()` — clears interval; called on every action submit and on game end
- `startGame(numPlayers)` → calls API, sets `screen = "role-reveal"`, starts polling if no immediate prompt
- `submitAction(type, value)` → calls API, handles `game_over` routing, resumes polling for NPC turns
- `proceedToGame()`, `goToGameOver()`, `resetGame()` — screen navigation functions

### GSAP Animation Modules (`src/animations/`)

All game animations use GSAP (GreenSock Animation Platform) — no CSS keyframes, no Framer Motion.

**`eyeAnimation.ts`** — Night phase transition:
- Two overlay panels (top half, bottom half) that cover the screen
- Close: both panels slide to center simultaneously (eyelids closing) using `gsap.to()`
- Open: both panels slide back to their edges (eyelids opening)
- Called at the start of each night phase and reversed at dawn

**`shatterAnimation.ts`** — Player death animation:
- When a player is eliminated, their seat card is duplicated into ~20 shards using CSS clip-path
- Each shard is assigned a random trajectory and rotation using `gsap.to()` with `ease: "power2.in"`
- All shards fall off screen within 1.2 seconds
- Original card hidden after animation completes

**`typewriterAnimation.ts`** — Narrator text reveal:
- Splits narrator text into individual words
- Uses `gsap.fromTo()` to stagger each word fading in with `opacity: 0 → 1`
- Configurable words-per-minute speed (`NARRATOR_WORD_MS = 130ms` per word)
- Returns a cleanup function that kills the GSAP timeline on component unmount

### Screen Components (`src/components/screens/`)

**`LandingScreen.tsx` (304 lines)**
- Full-screen title page with atmospheric dark background
- Animated hero image with subtle GSAP float animation
- Player count selector (4–10 players) with increment/decrement buttons
- "Begin the Night" CTA button — calls `useGame.startGame(numPlayers)`
- Loading state shown while API call is in progress

**`RoleRevealScreen.tsx` (416 lines)**
- 3D CSS card flip animation revealing the human's assigned role
- Card front: back-of-card design with lantern motif
- Card back: role name in role-specific color, flavor text describing the role's objectives
- Role-specific atmospheric description:
  - Mafia: "You are a wolf among sheep. Eliminate the village, one by one."
  - Detective: "You see through lies. Find the Mafia before the village falls."
  - Medic: "One life is in your hands each night. Choose wisely."
  - Villager: "Trust your instincts. The village depends on you."
- "Enter the Village" button transitions to `GameScreen`

**`GameScreen.tsx` (480 lines)**
The most complex component. Manages an independent **display phase state machine** that is decoupled from `gameState.phase`.

The backend phase changes instantly when nodes process, but the frontend needs to play full cinematic sequences. The display phase ensures correct ordering:
```
night → narrator → discussion → vote → vote-result → (next round: night | game-over)
```

Key logic:
- Watches `gameState.prompt.type` to determine when the backend is waiting for human input
- Plays GSAP eye animation when entering/exiting night phase
- Shows `NarratorBox` with typewriter animation during narrator phase
- Detects new entries in `investigation_ledger` to show detective reveal popup (persists after `NightPhase` unmounts)
- Manages speech bubble display for NPC statements on the round table
- Manages selectable player state for voting/night action pickers
- Calls `onGameOver()` after vote-result animations complete if `gameState.game_over`

**`GameOverScreen.tsx` (206 lines)**
- Displays winner announcement with dramatic heading (village green or mafia red)
- Full role reveal table — all NPC players' names and roles shown for the first time
- Human's own role highlighted in their role color
- Atmospheric flavor text per outcome
- "Play Again" button calls `resetGame()` → back to landing

### Game Board Component (`src/components/game/RoundTable.tsx` — 453 lines)
The central persistent scene that sits beneath all phase overlays.

- Circular arrangement of all player seats around a virtual table
- Each seat shows: player name, alive/dead indicator, role color accent (only human's own role revealed)
- Dead players show a skull indicator; their card greys out
- **Speech bubbles:** When NPCs speak during discussion, their bubble animates in above their seat using GSAP `fromTo(opacity, y)`; bubbles stagger one-by-one rather than all appearing at once
- `activeSpeaker` state highlights the current speaker's seat
- tsParticles ambient firefly/fog effects rendered in the background
- Human's seat marked with a distinct "YOU" badge

**`src/components/game/NarratorBox.tsx` (48 lines)**
- Positioned at the top of the game board
- Receives narrator text as prop
- Triggers `typewriterAnimation` via `useEffect` whenever text changes
- Styled with Lora serif font for atmospheric feel
- Fades in on appear, fades out on empty

### Phase Components (`src/components/phases/`)

**`NightPhase.tsx` (567 lines)**
- Night overlay rendered on top of the round table
- Shows "NIGHT FALLS" with eyelid animation playing
- If human has a night action: shows player picker grid with option cards for each valid target
- If human has no night action (Villager role): shows "You sleep through the night..." waiting state
- While NPC night turns run: shows atmospheric "The village sleeps..." with animated crickets indicator
- Detective-specific: after investigation, shows "You investigate [name]..." with suspense beat
- Handles all three night action types with appropriate UI copy

**`DiscussionPhase.tsx` (534 lines)**
- Day discussion overlay
- Receives `npc_statements` from the interrupt payload — animates each NPC statement appearing sequentially (staggered GSAP reveal on the round table speech bubbles)
- After all NPC statements shown: presents human's text input field
- Character counter, submit button disabled on empty input
- Displays round number, alive player count, current discussion turn
- NPC statements displayed in a scrollable log area below the input

**`VotePhase.tsx` (510 lines)**
- Vote ceremony overlay
- Receives `npc_votes` from the interrupt payload
- Vote ceremony animation: each NPC vote card flips one-by-one (GSAP 3D Y-axis rotation), revealing who they voted for — game-show style reveal
- Running tally updates as each vote is revealed
- After NPC ceremony completes: human vote picker appears (clickable player name cards)
- Human cannot vote for themselves (enforced frontend-side and API-side)
- Vote result banner shown after tally: elimination or tie message

### Frontend Architecture Decisions

- **No WebSockets:** API polling (`setInterval` at 1.5s) is sufficient for this turn-based game. Simpler to implement and debug than a WebSocket connection.
- **No Redux / Zustand:** All state lives in `useGame` hook. Game state is simple enough (one active game per session) that a single custom hook handles it cleanly.
- **Display phase decoupled from backend phase:** The `GameScreen` manages its own `displayPhase` state machine to sequence animations correctly regardless of when the backend resolves.
- **GSAP only for game animations:** Provides precise timeline control needed for the sequential vote ceremony and eyelid animation. CSS animations would not give the fine control needed.

---

## Part 13 — Deployment (`Dockerfile` + Google Cloud Run)

### Dockerfile
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONPATH=/app
ENV PORT=8080
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
```

Key decisions:
- `python:3.11-slim` — minimal base image for fast builds and small image size
- `libpq-dev` + `gcc` installed for `psycopg3` (Postgres adapter) compilation
- `ENV PYTHONPATH=/app` — ensures `from src.` and `from api.` imports resolve correctly when running inside the container
- `ENV PORT=8080` — Cloud Run injects the `PORT` env var; default matches Cloud Run's expected port
- No `EXPOSE` directive — Cloud Run manages port binding via `PORT` env var

### Production Fixes Applied During Deployment

**CORS configuration:** Production frontend origin added to `allow_origins` list in `api/main.py`; `allow_credentials=True` added.

**Thread pool for LLM calls:** LangGraph/LLM calls are blocking operations in an `asyncio` environment. Without the thread pool, FastAPI's event loop would block on every LLM call, causing HTTP gateway timeouts. `ThreadPoolExecutor(max_workers=4)` with `loop.run_in_executor()` runs blocking calls off the event loop.

**Postgres connection pool for Neon serverless:** Neon pauses idle compute and kills pre-opened connections with SSL errors. Solution: `ConnectionPool(min_size=0, open=True)` — pool is initialized but connections are opened lazily (only on first use), not pre-allocated at startup.

**Graph state race condition during polling:** Frontend polls `GET /game/{id}/state` every 1.5 seconds. During LLM calls (which take 2–5 seconds), the graph is mid-execution. A read during execution returned incomplete intermediate state. Fixed by reading state only from the checkpointer (`graph.get_state()`) and checking `snapshot.next` to determine if the graph is paused at an interrupt versus still running.

**Game completion edge case:** When a `POST /game/{id}/action` causes the final kill that ends the game, the graph reaches `END` while the response is being built. Added `_is_game_over()` guard to handle the case where `snapshot.next` is empty AND `game_over=True` — returns the final state correctly instead of 500.

---

## Part 14 — Documentation Written

| Document | Purpose | Size |
|----------|---------|------|
| `CLAUDE.md` | Project constitution — rules, layout, tech stack, build order | 211 lines |
| `docs/ARCHITECTURE.md` | Full technical architecture spec with code examples | 548 lines |
| `docs/GAME_RULES.md` | Complete game rules, all edge cases, victory conditions | 209 lines |
| `docs/AGENT_PROMPTS.md` | All LLM prompt templates with field injection specs | 316 lines |
| `docs/TASKS.md` | Phased implementation task list (8 phases, 30+ tasks) | 274 lines |
| `docs/API.md` | REST API specification for all 3 endpoints | 233 lines |
| `docs/TECHNICAL_OVERVIEW.md` | Concise summary of all completed phases | 137 lines |

---

## Complete File Inventory

### Backend (Python)
```
src/state.py                   — GameState schema (TypedDicts)
src/engine.py                  — Pure Python game logic
src/graph.py                   — LangGraph StateGraph wiring + Postgres/Memory checkpointer
src/agents/base_agent.py       — LLM call wrapper, retry logic, JSON parser
src/utils/state_views.py       — build_agent_view() information isolation
src/utils/prompts.py           — All 7 NPC prompt templates
src/nodes/setup_node.py        — Game initialization node
src/nodes/night_mafia_node.py  — Mafia kill decision (LLM + human interrupt)
src/nodes/night_detective_node.py — Detective investigation (LLM + human interrupt)
src/nodes/night_medic_node.py  — Medic protection (LLM + human interrupt)
src/nodes/resolve_night_node.py — Pure Python night outcome resolution
src/nodes/narrator_node.py     — LLM narrator announcement
src/nodes/day_discussion_node.py — Day discussion loop (LLM + human interrupt)
src/nodes/vote_node.py         — Voting phase (LLM + human interrupt)
src/nodes/win_check_node.py    — Win condition + round reset
api/main.py                    — FastAPI app, CORS, router registration
api/models.py                  — Pydantic v2 request/response schemas
api/session.py                 — In-memory game session store
api/routes/game.py             — All 3 HTTP endpoint handlers
```

### Tests
```
tests/test_engine.py           — 15 game logic tests
tests/test_state_views.py      — 10 information isolation tests
scripts/test_game.py           — Automated end-to-end game driver (251 lines)
```

### Frontend (TypeScript/React)
```
frontend/src/types/game.ts                    — TypeScript interfaces
frontend/src/api/client.ts                    — Axios API client
frontend/src/hooks/useGame.ts                 — Core game state hook
frontend/src/animations/eyeAnimation.ts       — GSAP night eyelid transition
frontend/src/animations/shatterAnimation.ts   — GSAP player death shatter
frontend/src/animations/typewriterAnimation.ts — GSAP narrator typewriter
frontend/src/components/screens/LandingScreen.tsx   — Title / start screen
frontend/src/components/screens/RoleRevealScreen.tsx — 3D role reveal card
frontend/src/components/screens/GameScreen.tsx       — Main game + phase state machine
frontend/src/components/screens/GameOverScreen.tsx   — Winner + full role reveal
frontend/src/components/game/RoundTable.tsx          — Persistent table scene
frontend/src/components/game/NarratorBox.tsx         — Narrator text display
frontend/src/components/phases/NightPhase.tsx        — Night overlay + picker
frontend/src/components/phases/DiscussionPhase.tsx   — Day discussion overlay
frontend/src/components/phases/VotePhase.tsx         — Vote ceremony overlay
frontend/src/App.tsx                                 — Root screen router
frontend/src/main.tsx                                — React entry point
frontend/src/index.css                               — Global CSS + Tailwind + DaisyUI
```

### Config & Deployment
```
Dockerfile                     — Container build for Cloud Run
requirements.txt               — Python dependencies
pyproject.toml                 — Python project metadata
frontend/package.json          — Node dependencies (React, GSAP, DaisyUI, Howler, etc.)
frontend/vite.config.ts        — Vite build configuration
frontend/tailwind.config.js    — Tailwind + DaisyUI theme config
.env.example                   — Required environment variable template
```

---

## Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| LangGraph `interrupt()` for human turns | Pauses the graph mid-execution at the exact human turn; no polling, no separate state machine needed. The graph checkpoints itself and resumes exactly where it stopped. |
| `build_agent_view()` as a mandatory firewall | Game integrity depends on agents not knowing others' roles. Enforced at the code layer — every LLM call and every `interrupt()` goes through this function, no exceptions. |
| `engine.py` has zero LLM calls | Game logic must be deterministic and testable without API keys. Separating logic from language generation makes testing, debugging, and reasoning about correctness much simpler. |
| `Annotated[list, add]` for `public_log` | Lets multiple nodes append to the same list across a round without any node overwriting another's entries. LangGraph handles the merge automatically. |
| NPC votes before human interrupt | Human always votes with full knowledge of how NPCs voted — more strategic and more dramatically satisfying. Also allows the frontend to play the vote ceremony animation before asking the human. |
| NPCs speak before human in discussion | Human sees all NPC statements before forming their own response — mimics real Mafia gameplay and gives the human the most context. |
| `ThreadPoolExecutor` for LLM calls in FastAPI | LangGraph graph invocations are synchronous. Without the thread pool, every LLM call would block FastAPI's async event loop, causing all other requests to time out during a turn. |
| Polling over WebSockets | Turn-based game with 2–5 second NPC turns. 1.5s polling is entirely adequate; no need for the complexity of WebSocket connection management. |
| Display phase decoupled from backend phase in frontend | Backend phase transitions happen at node completion speed. Frontend needs to sequence animations (eye close, narrator typewriter, vote ceremony) before moving on. Decoupling the display state machine gives full control over timing. |
| `min_size=0` lazy Postgres pool | Neon serverless kills pre-opened connections during cold starts. Lazy pool (connections open on first use) avoids SSL errors that would crash the server on startup. |
