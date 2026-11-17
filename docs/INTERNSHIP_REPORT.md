# Internship Final Report — Mafia Interactive Game (Human vs. LLM)

**Intern:** Pasindu Ravishan
**Project Title:** Mafia Interactive Human-vs-LLM Game
**Duration:** April 6, 2026 – April 20, 2026 (2 weeks)
**Repository:** `PasinduRavishan/Mafia` (deployment branch: `deployment`)
**Total Commits:** 27 · **Files Created:** ~65+ · **Lines of Code:** ~12,000+

---

## 1. Executive Summary

This project is a full-stack, production-deployed implementation of the classic social
deduction game **"Mafia,"** built as a learning exercise in agentic AI orchestration,
human-in-the-loop system design, and modern full-stack web development.

The core idea: **one human player** joins a game of Mafia where every other participant
is an autonomous **LLM-powered NPC agent** (Anthropic's Claude Sonnet). The human is
randomly assigned a role — Mafia, Detective, Medic, or Villager — exactly like any other
player, and plays through night actions, day discussion, and voting via a web interface.
The AI agents reason, scheme, lie, and vote entirely on their own, each constrained to
only the information their role would realistically know.

The project was built using a **spec-driven development (SDD)** methodology with Claude
Code as an AI pair-programmer: every architecture decision, API contract, game rule, and
prompt template was documented in writing *before* any code was written. This produced a
fully specified, testable, and incrementally verifiable system across 8 build phases.

**What was learned and demonstrated:**
- Designing and operating a multi-agent LLM system with strict information isolation
- Using **LangGraph** to model a complex game as a deterministic state machine with
  human-in-the-loop interrupts
- Separating deterministic business logic from LLM-generated content (a critical
  architecture pattern for any LLM-backed application)
- Building and deploying a full REST API (FastAPI) and a cinematic single-page React
  frontend (GSAP-animated)
- Diagnosing and fixing real production issues: concurrency bugs, race conditions during
  polling, and cloud deployment configuration (Docker, Google Cloud Run, Neon Postgres)
- Practicing spec-driven development as a discipline for working effectively with an AI
  coding assistant

---

## 2. Problem Statement & Goals

Traditional Mafia/Werewolf is a party game that requires 6+ human players in person.
The goal of this internship project was to answer: **can a single human play a full,
strategically meaningful game of Mafia against AI opponents that behave believably —
scheming, deceiving, and reasoning — while respecting the same information constraints
a human player would have?**

Secondary learning goals (set by the internship structure):
1. Master **LangGraph** state machines for orchestrating multi-step, multi-agent workflows
2. Practice **multi-agent information isolation** — a core challenge in any system where
   multiple LLM agents share a world but must not share private knowledge
3. Implement an **interactive human-in-the-loop** pattern (not just batch LLM calls)
4. Practice **spec-driven development** with an AI coding assistant (Claude Code)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│  React + TypeScript Frontend (SPA)                  │
│  LandingScreen · RoleReveal · GameScreen · GameOver  │
│  GSAP animations · Howler.js audio · tsParticles     │
└────────────────────┬────────────────────────────────┘
                      │ HTTP polling (REST API)
┌────────────────────▼────────────────────────────────┐
│  FastAPI Backend                                     │
│  POST /game/start                                    │
│  GET  /game/{id}/state                                │
│  POST /game/{id}/action                               │
└────────────────────┬────────────────────────────────┘
                      │
┌────────────────────▼────────────────────────────────┐
│  LangGraph StateGraph — Game Orchestration Engine    │
│  9 nodes → interrupt() for human turns               │
│  MemorySaver / PostgresSaver checkpointer            │
└────────────────────┬────────────────────────────────┘
                      │
┌────────────────────▼────────────────────────────────┐
│  NPC Agents (Claude Sonnet)                          │
│  Mafia · Detective · Medic · Villager                │
│  Each receives only build_agent_view() filtered state │
└─────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology |
|---|---|
| Game logic | Pure Python 3.11/3.12 (`engine.py`) — zero LLM calls |
| State schema | Python `TypedDict` (`state.py`) |
| Orchestration | LangGraph `StateGraph` with `interrupt()` human-in-the-loop pattern |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via `langchain-anthropic`, swappable provider (Gemini, Groq also supported) |
| Observability | LangSmith — traces every node and agent call with game metadata |
| Backend API | FastAPI + Uvicorn, Pydantic v2 schemas |
| State persistence | `MemorySaver` (local dev) / `PostgresSaver` on Neon (production) |
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + DaisyUI ("night" dark theme) |
| Animation | GSAP (GreenSock) exclusively — no Framer Motion, no CSS keyframes for game animation |
| Audio | Howler.js (planned/partial — Phase 8) |
| Particles | tsParticles (fog/firefly ambience) |
| Deployment | Docker → Google Cloud Run, Neon serverless Postgres |
| Testing | Pytest (25 unit tests, zero API keys required) |

### 3.3 Core Architectural Principles

1. **Determinism in logic, creativity in language.** All game-deciding logic (who dies,
   who wins, vote tallying) lives in pure Python (`engine.py`) with **zero LLM calls**.
   LLMs are used *only* to generate dialogue, role-play decisions, and narration. This
   makes the rules of the game fully testable and auditable without ever calling an API.
2. **Information isolation as a code-level firewall.** No agent (human or LLM) is ever
   given the full `GameState`. Every participant receives output from a single function,
   `build_agent_view(player_id, state)`, that filters the state down to exactly what that
   role is allowed to know. This is enforced in code, not by asking the LLM nicely to
   "forget" things — a key lesson in building trustworthy multi-agent systems.
3. **Human-in-the-loop via LangGraph `interrupt()`**, not `input()`. The human player is
   a first-class participant in the graph. When it's their turn, the relevant node calls
   `interrupt(payload)`, which pauses graph execution entirely and hands control back to
   the FastAPI layer. The frontend displays the prompt, the human responds via
   `POST /game/{id}/action`, and the graph resumes from the exact point it paused
   (`graph.invoke(Command(resume=value), config)`). This is the canonical LangGraph
   pattern for async, multi-turn human interaction — no polling loops or blocking
   `input()` calls anywhere in the graph itself.
4. **Bounded loops.** A `discussion_turns_left` counter prevents the day-discussion phase
   from running indefinitely (and racking up unbounded LLM token costs). A
   `max_rounds = 20` safety cutoff prevents a game from running forever if no win
   condition is reached.
5. **State immutability.** Every LangGraph node returns a **partial dict** of only the
   state keys it changed — never the full state object, and never a direct mutation.
   Fields that accumulate across the game (like `public_log` and `dead_player_ids`) use
   LangGraph's `Annotated[list, add]` reducer pattern so multiple nodes can safely append
   without overwriting each other's writes.

---

## 4. Game Design

### 4.1 Roles

| Role | Team | Night Action | Private Knowledge |
|---|---|---|---|
| **Mafia** (Thief) | Mafia | Choose one living player to eliminate | Knows identities of all other Mafia members |
| **Villager** | Village | None — sleeps | None |
| **Detective** (Police) | Village | Investigate one player → learns true alignment (Mafia/Innocent) | Private investigation ledger, persists across rounds |
| **Medic** (Doctor) | Village | Protect one player from elimination that night | Knows who they protected; not whether Mafia targeted that player; can self-heal once per game |

### 4.2 Game Loop

```
SETUP → NIGHT (Mafia → Detective → Medic) → RESOLVE → NARRATOR
      → DAY DISCUSSION → VOTE → WIN CHECK → (loop back to NIGHT or END)
```

### 4.3 Victory Conditions
- **Village wins** when all Mafia members are eliminated (`mafia_count == 0`)
- **Mafia wins** when `mafia_count >= village_count` among living players (e.g., 1 Mafia
  vs. 1 Villager ends the game in Mafia's favor)

### 4.4 Key Edge Cases Implemented
- **Cross-save:** Mafia targets Player A, Medic independently saves Player A → no death,
  and *neither* the Mafia nor the Medic learns what the other did.
- **Tie vote:** No majority → no elimination ("Hung Jury"), game proceeds to the next
  night.
- **The Last Stand:** With 3 players left (1 Mafia, 2 Village), an incorrect village vote
  immediately hands Mafia the win on the next round.
- **Personality-driven NPCs:** Every NPC is randomly assigned `aggressive`, `defensive`,
  or `analytical` personality at game start, which is injected into their system prompt
  to diversify dialogue and decision-making style across games.

---

## 5. Backend Implementation Detail

### 5.1 Data Model (`src/state.py`)

The entire game's data flows through a single `GameState` TypedDict, including
`all_players` (full roster with hidden roles), `alive_player_ids` /
`dead_player_ids`, `round_number`, `phase`, `night_actions`, `public_log`,
`day_statements`, `discussion_turns_left`, `votes`, `vote_result`,
`detective_ledger`, `medic_self_heal_used`, `winner`, and `game_over`.

### 5.2 Pure Python Game Engine (`src/engine.py`)

Four deterministic functions with zero LLM dependency:
- `assign_roles(player_ids, config)` — randomly distributes roles and personalities
- `resolve_night_actions(night_actions)` — applies the cross-save rule
- `tally_votes(votes)` — counts votes, returns `None` on tie
- `check_win_condition(alive_players)` — evaluates both win conditions

### 5.3 Information Isolation (`src/utils/state_views.py`)

The single function `build_agent_view(player_id, state)` is the **only** sanctioned way
any participant — human or LLM — receives game state. It returns a role-filtered view:
Mafia gets `mafia_teammates`; Detective gets `investigation_ledger`; Medic gets
`medic_self_heal_used`; Villagers get only public information. This same function
powers both the LLM prompt construction *and* the human-facing API response, guaranteeing
parity of information access between the human and the NPCs.

### 5.4 LangGraph Orchestration (`src/graph.py`)

A 9-node `StateGraph(GameState)`:

```
START → setup → night_mafia → night_detective → night_medic → resolve_night
      → narrator → day_discussion → vote → win_check
                                              │
                          ┌───────────────────┼────────────────────┐
                     "continue"          "village_wins"        "mafia_wins"
                  → back to night_mafia        → END                 → END
```

Checkpointing is provided by `MemorySaver` (local dev) or `PostgresSaver` (production,
auto-detected via `DATABASE_URL`), keyed by `game_id` as the LangGraph `thread_id`. This
is what allows the graph to be paused at a human `interrupt()` and resumed correctly on a
separate, later HTTP request.

### 5.5 LLM Agent Infrastructure (`src/agents/base_agent.py`)

- Swappable LLM provider system (Claude / Gemini / Groq) behind a single constant
- Lazy singleton LLM client instantiation
- `call_agent()` with retry + exponential backoff on rate-limit/overload errors
- `parse_json_response()` — a 3-stage JSON extractor that handles clean JSON, markdown
  code-fenced JSON, and mixed text/JSON LLM outputs, with a final `ValueError` if all
  three fail
- Fallback logic: if an LLM-chosen target is invalid (dead, self, malformed JSON), the
  system falls back to a random valid choice rather than crashing the game

### 5.6 Prompt Engineering (`docs/AGENT_PROMPTS.md`, `src/utils/prompts.py`)

Seven distinct prompt templates (Mafia night/day, Detective night/day, Medic night/day,
Villager day, Vote, Narrator). Each enforces structured JSON output for decisions
(`{"target": "...", "reasoning": "..."}`) and free-text natural language for discussion
statements. Prompts explicitly instruct agents never to reveal their role outright and to
use personality-specific tactics (e.g., "Detective: plant suspicion without confirming
your role — if you reveal you're the Detective, the Mafia will target you next").

### 5.7 REST API (`api/`)

Three endpoints, fully specified in `docs/API.md`:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/game/start` | Creates a session, assigns roles, runs the graph until the first human-facing prompt |
| `GET` | `/game/{id}/state` | Polled by the frontend to observe NPC turns completing |
| `POST` | `/game/{id}/action` | Human submits a night target / day statement / vote, resuming the paused graph |

Implementation notes:
- LangGraph invocations are blocking, synchronous calls (they make LLM API calls that
  take 1–5 seconds). A `ThreadPoolExecutor(max_workers=4)` runs them off FastAPI's async
  event loop so concurrent requests don't time out.
- Session state lives in an in-memory `GAMES` dict (`api/session.py`); the LangGraph
  checkpointer is the actual source of truth for game state.
- Error handling: `404` (game not found), `409` (action submitted when not waiting on
  human input), `400` (invalid target — dead player, self-vote, etc.)

---

## 6. Frontend Implementation Detail

### 6.1 Design Philosophy

The frontend was designed around a **persistent round-table scene**: a circular table
with player avatar seats and a cloaked narrator figure, with every game phase rendered as
an animated overlay on top of this single, never-disappearing world. This was chosen
deliberately over a series of disconnected screens to make the game feel like one
continuous, cinematic experience rather than a form wizard.

### 6.2 Visual & Audio Design System

- **Theme:** Dark Gothic Village — near-black backgrounds, amber lantern-light accents,
  blood-red/blue/green/grey role colors
- **Fonts:** Cinzel Decorative (titles), Lora (narrator speech), Inter (UI chrome),
  JetBrains Mono (game log)
- **Animation:** 100% GSAP (GreenSock) — eyelid open/close for night transitions, card
  shatter for deaths, word-by-word typewriter for narrator text, staggered speech bubbles,
  game-show-style sequential vote-card flips
- **Sound design map:** crickets, heartbeat on Mafia turn, investigative piano on
  Detective turn, warm chime on Medic turn, morning birds, drumroll on vote, shatter
  sting on elimination, victory fanfare / wolf howl on game end

### 6.3 Screen & Component Architecture

```
LandingScreen → RoleRevealScreen → GameScreen (persistent round table)
                                       ├─ NightPhase     (eyelid sequence, role picker)
                                       ├─ NarratorBox    (typewriter dawn announcement)
                                       ├─ DiscussionPhase (staggered NPC speech + human input)
                                       └─ VotePhase       (sequential vote reveal + shatter)
                                       → GameOverScreen (full role reveal table)
```

### 6.4 State Management

No Redux, no Zustand, no WebSockets — a deliberate simplicity decision. A single
`useGame` hook manages all game state via `useState`, polling `GET /game/{id}/state`
every 1.5 seconds while waiting for NPC turns to resolve, and stopping automatically once
a `prompt` or `game_over` is received. A notable design pattern: the **frontend display
phase is decoupled from the backend's `phase` field** — the backend can transition phases
instantly, but the frontend needs to sequence multi-second cinematic animations (eyelid
close, narrator typewriter, vote ceremony) in the correct order regardless of backend
timing.

---

## 7. Testing Strategy

- **`tests/test_engine.py` — 15 tests** covering night resolution (including cross-save),
  vote tallying (including ties), win conditions, and role assignment — all run with
  **zero LLM calls and zero API keys**.
- **`tests/test_state_views.py` — 10 tests** verifying information isolation: e.g.,
  asserting `mafia_teammates` never appears in a Villager's view, `investigation_ledger`
  never leaks to Mafia, etc.
- **Result: 25/25 tests passing**, fully decoupled from any external API — this was a
  deliberate Phase 1 requirement so the rules engine could be proven correct before any
  LLM cost was incurred.
- **`scripts/test_game.py`** — a 251-line automated driver that plays full games via the
  live HTTP API with randomized auto-responses, used to verify both win conditions are
  reachable, the cross-save and tie-vote scenarios behave correctly, and the
  `max_rounds = 20` safety cutoff terminates runaway games.

---

## 8. Deployment & Production Engineering

The application was containerized (Docker, `python:3.11-slim` base image) and deployed to
**Google Cloud Run**, backed by a **Neon serverless Postgres** database for LangGraph
checkpoint persistence (replacing the in-memory `MemorySaver` used in local development).

Deployment surfaced a class of real production bugs not visible in local testing —
documented across **13 fix commits** over roughly 5 hours of debugging on April 20, 2026:

| Category | Issues Found & Fixed |
|---|---|
| **Docker / config** | Oversized image trimmed to slim base; CORS origin misconfiguration; 500 errors on completed games |
| **LangGraph concurrency** | `MemorySaver` was not safe under concurrent requests; introduced per-game-id locking around graph invocations (later simplified after an initial over-engineered fix) |
| **Frontend–backend wiring** | Missing top-level screen router; phase-detection and component-unmount bugs between night/day transitions |
| **State race conditions under polling** | The frontend's 2-second polling interval could read the LangGraph state *mid-execution*, returning incomplete intermediate state. Root-caused and fixed by reading state exclusively from the checkpointer and explicitly checking `snapshot.next` to know whether the graph is paused at an interrupt vs. still running |
| **Game-completion edge case** | A `POST /action` call that triggers the game-ending move could reach LangGraph's `END` state while the response was still being built, causing a 500 error — fixed with an explicit `_is_game_over()` guard |

Other production-specific engineering decisions:
- **`ConnectionPool(min_size=0, open=True)`** for the Neon Postgres connection — Neon
  kills pre-opened idle connections on cold start, so connections are opened lazily on
  first use instead of pre-allocated at startup.
- **`ThreadPoolExecutor`** to keep blocking LLM calls off FastAPI's async event loop in
  production traffic conditions.

This debugging phase was, in practice, the most valuable learning experience of the
project: it surfaced real distributed-systems concerns (concurrency, race conditions,
serverless cold-start behavior) that don't appear when running a single local instance.

---

## 9. Spec-Driven Development Methodology

This project deliberately followed a **spec-first** workflow when working with Claude
Code as an AI pair programmer:

1. Write the architecture spec (`ARCHITECTURE.md`), game rules (`GAME_RULES.md`), API
   contract (`API.md`), and prompt templates (`AGENT_PROMPTS.md`) **before** writing any
   implementation code.
2. Maintain a living task list (`TASKS.md`) broken into 8 sequential phases, each with
   atomic, independently-testable tasks.
3. `CLAUDE.md` acted as a persistent "project constitution" — re-loaded by Claude Code at
   the start of every session — encoding the non-negotiable rules (information isolation,
   logic/LLM separation, state immutability) so they couldn't be silently violated as the
   codebase grew.
4. Each task was implemented, tested, and (per project policy) left for the human
   developer to commit — the AI assistant never ran `git commit` directly.

**Why this mattered:** with an AI coding assistant, the main failure mode is *drift* —
the assistant re-deriving incorrect assumptions about a system it doesn't fully hold in
context. Writing the spec first and re-reading the relevant section before each task
anchored every implementation decision in a written, reviewable source of truth, rather
than in the assistant's (or the intern's) memory of an earlier conversation.

---

## 10. Build Timeline (Phase-by-Phase)

| Phase | Date | What Was Built | Result |
|---|---|---|---|
| **1 — Foundation** | Apr 6 (AM) | `state.py`, `engine.py`, `state_views.py` — pure Python game logic and data model, no LLM/server | 25/25 tests passing, zero API keys |
| **2 — Graph Skeleton** | Apr 6 (PM) | `graph.py` with all 9 nodes wired (stubbed) | Graph compiles; Mermaid topology verified |
| **3 — FastAPI Server** | Apr 6 (PM) | `api/main.py`, `routes/game.py`, `models.py`, `session.py` | All 3 endpoints reachable via Swagger UI |
| **4 — Night Phase Agents** | Apr 6 (PM) | `base_agent.py`, `prompts.py`, 3 night nodes + human interrupt wiring | LLM calls traced in LangSmith; no role leakage in prompts |
| **5 — Day Phase** | Apr 6 (PM) | `narrator_node.py`, `day_discussion_node.py`, `vote_node.py` | Full round playable end-to-end |
| **6 — Full Game Loop** | Apr 6 (PM) | `win_check_node.py`, round reset logic, `scripts/test_game.py` | Both win conditions verified; safety cutoff confirmed |
| **Testing & bug fixes** | Apr 7 | E2E automated testing surfaced and fixed 5 node-level bugs (discussion loop, narrator cross-save case, vote tallying, target validation) | Stable full-game loop |
| **7 — React Frontend** | Apr 20 (PM) | Full cinematic SPA — 4 screens, 3 animated phase overlays, 3 GSAP animation modules — ~9,500 lines across 47 files | Production build, 0 TypeScript errors |
| **Deployment** | Apr 20 (Eve) | Docker + Google Cloud Run + Neon Postgres; 13 fix commits resolving concurrency, race conditions, and config issues | Live, stable production deployment |

---

## 11. Key Technical Concepts Mastered

### LangGraph
- `StateGraph` as a typed state machine where every node returns a *partial* state update
- `Annotated[list, add]` reducers for safe multi-node list accumulation
- `interrupt()` / `Command(resume=value)` for pausing and resuming graph execution around
  human input — the canonical async human-in-the-loop pattern
- `MemorySaver` vs. `PostgresSaver` checkpointers, and reading graph state via
  `graph.get_state(config)` / `snapshot.next` to distinguish "paused at interrupt" from
  "still running" from "completed"
- Conditional edges with a routing function to implement the win-check loop-back

### FastAPI + Pydantic v2
- Clean request/response contracts via Pydantic v2 models
- Running blocking (LLM-calling) work off the async event loop with
  `ThreadPoolExecutor` + `run_in_executor`
- In-memory session-store pattern for managing per-game state alongside a stateful
  external checkpointer

### LangChain / Anthropic
- `ChatAnthropic` client usage, `SystemMessage`/`HumanMessage` prompt structuring
- Multi-provider abstraction (Claude/Gemini/Groq) behind one interface
- Robust JSON extraction from LLM free-text output, with retry/backoff on transient
  provider errors

### React + TypeScript
- Custom hooks for centralized state + polling instead of Redux/WebSockets
- GSAP timeline orchestration for complex, multi-step cinematic sequences
- Decoupling a frontend's own animation/display state machine from a backend's raw state
  field, to control pacing independently of backend response timing

### Multi-Agent System Design
- Information isolation as a **code-level constraint**, not a prompting convention —
  the single most important architectural lesson of the project: never trust an LLM to
  "not look at" information it was given; instead, never give it that information at all.
- Personality-driven prompting as a lightweight technique for generating behaviorally
  diverse agents from the same underlying model.

---

## 12. Engineering Decisions & Rationale (Summary Table)

| Decision | Rationale |
|---|---|
| LangGraph `interrupt()` for human turns | Pauses the graph at the exact human turn; no polling state machine needed outside the graph itself |
| `build_agent_view()` as a mandatory firewall | Game integrity depends on agents never learning others' roles — enforced at the code layer with no exceptions |
| `engine.py` has zero LLM calls | Game logic must be deterministic, fast, and testable without API keys or network access |
| `Annotated[list, add]` for `public_log` | Lets multiple nodes append to the same list across a round without overwriting each other |
| NPC votes resolved before human interrupt | Human always votes with full knowledge of NPC votes — more strategic, and lets the frontend play a vote ceremony animation first |
| NPCs speak before human in discussion | Mirrors real Mafia gameplay; gives the human maximum context before committing to a statement |
| `ThreadPoolExecutor` for LLM calls in FastAPI | Without it, every LLM call would block FastAPI's async event loop and cause concurrent requests to time out |
| Polling over WebSockets | Turn-based game with multi-second NPC turns; 1.5s polling is simpler to build and debug than WebSocket connection management |
| Frontend display-phase decoupled from backend phase | Backend phase transitions happen instantly at node completion; frontend needs to sequence multi-second animations independently |
| `min_size=0` lazy Postgres pool | Neon serverless kills pre-opened idle connections; lazy connection-on-first-use avoids cold-start SSL failures |

---

## 13. Outcomes & Definition of Done

By the end of the internship period, the project satisfied its original Definition of
Done:
- ✅ Human receives a random role at game start and is told what they can/can't see
- ✅ Human can type day statements and cast votes interactively through the web UI
- ✅ LLM NPCs autonomously handle all other roles, including deception and reasoning
- ✅ Mafia NPC agents never see other players' true roles in their prompts (verified via
  LangSmith trace inspection)
- ✅ Detective's private ledger persists correctly across rounds
- ✅ Cross-save scenario (Mafia kill + Medic save on the same target) correctly results
  in no death
- ✅ Both win conditions (Village wins, Mafia wins) correctly trigger and halt the graph
- ✅ LangSmith produces clean, nested traces per game round with game metadata
- ✅ All 25 `test_engine.py` / `test_state_views.py` tests pass with no LLM calls required
- ✅ Application deployed and stable in production (Google Cloud Run + Neon Postgres)

**Outstanding / future work** (not completed within the internship window):
- `tests/test_integration.py` — formal integration tests for the API layer (session init,
  invalid-action rejection, game-not-found) were planned (Phase 6.4) but not finalized
- Howler.js sound implementation — designed in full (`docs/USERFLOW.md` sound map) but
  marked "Phase 8 — 🔜" and not yet wired into the frontend
- Individual vote-card flip animation and player-card shatter-on-death animation were
  designed and partially implemented but listed as "🔜 Next" in the frontend status table
- LangSmith metadata tagging pass (Phase 8.1) and a dedicated error-handling pass
  (Phase 8.2) remain open items

---

## 14. Repository Reference

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project constitution — rules, layout, tech stack, critical constraints |
| `docs/ARCHITECTURE.md` | Full technical architecture spec with code-level detail |
| `docs/GAME_RULES.md` | Authoritative game rules and edge-case reference |
| `docs/API.md` | REST API specification for all 3 endpoints |
| `docs/AGENT_PROMPTS.md` | All LLM prompt templates used by NPC agents |
| `docs/FRONTEND_SPEC.md` | Frontend technology and design option analysis |
| `docs/USERFLOW.md` | Finalized screen-by-screen UX and GSAP animation spec |
| `docs/TASKS.md` | Phased implementation task list (8 phases) |
| `docs/TECHNICAL_OVERVIEW.md` | Short phase-by-phase technical summary |
| `docs/PROJECT_WORK.md` | Exhaustive technical documentation of every module built |
| `docs/INTERN_DIARY.md` | Day-by-day development diary with commit references |
| `src/`, `api/`, `frontend/`, `tests/`, `scripts/` | Source code (see file inventory in `PROJECT_WORK.md`) |

---

*This report was compiled from the project's own specification documents
(`docs/ARCHITECTURE.md`, `docs/GAME_RULES.md`, `docs/API.md`, `docs/AGENT_PROMPTS.md`,
`docs/FRONTEND_SPEC.md`, `docs/USERFLOW.md`, `docs/TASKS.md`,
`docs/TECHNICAL_OVERVIEW.md`, `docs/PROJECT_WORK.md`, `docs/INTERN_DIARY.md`), the
current source tree, and the project's git commit history (27 commits, verified against
the diary).*
