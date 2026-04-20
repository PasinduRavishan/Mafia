# CLAUDE.md — Mafia Interactive Game: Project Constitution

> **This file is the single source of truth for Claude Code.**
> Read this file completely before touching any code. Every decision made in this project flows from this document.

---

## What This Project Is

An **interactive, human-vs-LLM implementation of the social deduction game "Mafia"** built with LangGraph + LangSmith.

**ONE human player participates** in every game. They are assigned a random role (Mafia, Detective, Medic, or Villager) at the start of each game and play alongside LLM-powered NPC agents who fill all other roles. The human types their own day discussion statements and casts their own votes. LLM agents handle all non-human roles autonomously.

**Purpose:** Internship/learning project to master LangGraph state machines, multi-agent information isolation, interactive human-in-the-loop patterns, and spec-driven development with Claude Code.

---

## Repository Layout

```
mafia/
├── CLAUDE.md                   ← YOU ARE HERE. Read first, always.
├── README.md                   ← Quick-start for humans
├── docs/
│   ├── ARCHITECTURE.md         ← Full technical architecture (read second)
│   ├── GAME_RULES.md           ← Complete game logic & edge cases
│   ├── AGENT_PROMPTS.md        ← All agent system prompt templates
│   ├── API.md                  ← FastAPI endpoint specification
│   └── TASKS.md                ← Implementation task list with status
├── src/
│   ├── state.py                ← GameState TypedDict definition ✅
│   ├── engine.py               ← Pure Python game logic (no LLM) ✅
│   ├── graph.py                ← LangGraph StateGraph wiring ✅
│   ├── nodes/
│   │   ├── setup_node.py       ← stub ✅ → implement in Phase 4
│   │   ├── night_mafia_node.py
│   │   ├── night_detective_node.py
│   │   ├── night_medic_node.py
│   │   ├── resolve_night_node.py
│   │   ├── narrator_node.py
│   │   ├── day_discussion_node.py
│   │   ├── vote_node.py
│   │   └── win_check_node.py
│   ├── agents/
│   │   ├── base_agent.py       ← Shared agent logic + prompt builder
│   │   ├── mafia_agent.py
│   │   ├── detective_agent.py
│   │   ├── medic_agent.py
│   │   └── villager_agent.py
│   └── utils/
│       ├── state_views.py      ← build_agent_view() — information isolation ✅
│       └── logging.py          ← LangSmith tagging helpers
├── api/
│   ├── __init__.py
│   ├── main.py                 ← FastAPI app + route registration
│   ├── routes/
│   │   ├── __init__.py
│   │   └── game.py             ← /game endpoints
│   ├── models.py               ← Pydantic request/response schemas
│   └── session.py              ← In-memory game session store
├── tests/
│   ├── test_engine.py          ← Pure Python logic tests ✅
│   ├── test_state_views.py     ← Information isolation tests ✅
│   └── test_integration.py    ← Full game round tests (Phase 6)
├── .env.example
├── requirements.txt
└── pyproject.toml
```

---

## Critical Rules — Never Break These

### 1. Information Isolation (MOST IMPORTANT)
```
NEVER pass the full GameState to any agent LLM call.
ALWAYS use build_agent_view(player_id, game_state) to filter state first.
Mafia agents see: their own role + list of mafia teammates only.
Detective agents see: their own role + their private investigation ledger only.
Villager/Medic agents see: public_log only. No role information of others.
```

### 2. Logic vs. LLM Separation
```
NEVER use an LLM to resolve game logic (kill resolution, vote tallying, win checks).
ALL game logic lives in engine.py as pure Python functions.
LLMs are ONLY used for generating natural language dialogue and decisions.
```

### 3. State Immutability in Nodes
```
Nodes MUST return partial state dicts, not mutate the incoming state.
Return only the keys that changed: return {"night_actions": updated_actions}
```

### 4. Max Discussion Turns
```
The day_discussion_node MUST check state["discussion_turns_left"] > 0.
If 0, skip to vote. This prevents infinite loops and token cost explosions.
Default max turns: 3 per player per round.
```

---

## Tech Stack

### Backend (build now)
| Package | Version | Purpose |
|---|---|---|
| `fastapi` | `>=0.111.0` | REST API server |
| `uvicorn` | `>=0.30.0` | ASGI server |
| `langgraph` | `>=0.2.0` | Game graph orchestration + human interrupt |
| `langchain-anthropic` | `>=0.3.0` | Claude as NPC agent LLM |
| `langchain-core` | `>=0.3.0` | Base types, messages |
| `langsmith` | `>=0.2.0` | Tracing & observability |
| `pydantic` | `>=2.0` | Request/response models + state validation |
| `python-dotenv` | `>=1.0` | Environment variable loading |
| Python | `>=3.11` | f-strings, TypedDict, match statements |

### Frontend (Phase 7 — Active)
| Tech | Version | Purpose |
|---|---|---|
| React + Vite + TypeScript | Latest | UI framework — SPA, no SSR needed |
| Tailwind CSS | v3 | Utility-first styling |
| DaisyUI | v4 | Component theme system — use "night" dark theme |
| GSAP (GreenSock) | v3 | ALL animations — no Framer Motion, no CSS keyframes for game animations |
| Howler.js | v2 | Sound — crickets, heartbeat, morning birds, vote drumroll, shatters |
| tsParticles | Latest | Fog / firefly ambient particle effects |

**Frontend Critical Rules:**
```
ALWAYS use GSAP for all game animations (eye open/close, card flip, shatter, typewriter).
NEVER use Framer Motion — GSAP is the animation layer, period.
ALWAYS use DaisyUI "night" theme as base — override with custom CSS only when needed.
ALWAYS follow docs/USERFLOW.md for every screen and animation sequence.
ALL game state comes from API polling — no WebSockets, no Redux, useState + polling only.
NEVER show a spinner alone for NPC turns — always show the cinematic night/day scene.
```

**Frontend Color Palette:**
```css
--bg:       #0d0d0d   /* near black background */
--card:     #1a1a2e   /* dark navy card surface */
--accent:   #e8a838   /* lantern amber — primary CTA, glows */
--mafia:    #c0392b   /* blood red — Mafia role */
--detective:#2980b9   /* midnight blue — Detective role */
--medic:    #27ae60   /* forest green — Medic role */
--villager: #7f8c8d   /* muted grey — Villager role */
--text:     #e8e8e8   /* off-white body text */
--muted:    #4a4a5a   /* dimmed elements */
```

**Frontend Fonts (Google Fonts):**
```
Cinzel Decorative  — game title, phase headers
Lora               — narrator speech (serif, atmospheric)
Inter              — UI chrome, buttons, labels
JetBrains Mono     — game log panel (terminal feel)
```

**Frontend Design Vision:**
- Persistent round-table scene — all game phases happen as overlays on the table
- Eyelid open/close animation for night phase transitions (GSAP panels slide top+bottom)
- Card shatter on death (GSAP shards fall off screen)
- Word-by-word typewriter for narrator text (GSAP SplitText or manual char split)
- NPC speech bubbles stagger in one-by-one above their player seat
- Vote reveal animates each vote card flip one-by-one (game-show style)
- Role reveal via 3D spinning card flip
- Morning sunrise gradient on day transition
- Full atmospheric sounds at every game moment

LLM Model for all NPC agents: `claude-sonnet-4-6`

---

## Environment Variables Required

```bash
ANTHROPIC_API_KEY=your_key_here
LANGSMITH_API_KEY=your_key_here
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=mafia-simulation
```

---

## Build Order (Spec-Driven Phases)

**Phase 1 — Foundation (No LLM)** ✅ COMPLETE
Build and fully test: `state.py` → `engine.py` → `state_views.py` → all tests pass

**Phase 2 — Graph Skeleton** ✅ COMPLETE
Wire: `graph.py` with all nodes stubbed → graph compiles + Mermaid verified

**Phase 3 — FastAPI Server**
Build: `api/main.py` → game session management → `/game/start` + `/game/action` + `/game/state`
Human-in-the-loop via LangGraph `interrupt()` pattern

**Phase 4 — Night Phase Agents**
Build NPC agents one at a time: Mafia → Detective → Medic
Human gets CLI-style prompts via API response when it's their night turn.

**Phase 5 — Day Phase**
Build: `narrator_node.py` → `day_discussion_node.py` → `vote_node.py`
Human submits day statement + vote via `POST /game/{id}/action`

**Phase 6 — Full Game Loop**
Wire win_check → loop or END. Run complete games via API. Verify all win conditions.

**Phase 7 — Frontend**
React + TypeScript UI consuming the FastAPI backend. Game board, role reveal, live log.

**Phase 8 — Observability & Polish**
LangSmith tags, metadata, game_round tracking across all nodes.

---

## Human Player Rules

```
ONE slot in the player roster is always "human" (player_id = "human").
The human is assigned a random role at setup, same as any NPC.
During night phase: if the human's role has a night action, prompt them via CLI input().
During day discussion: skip LLM call for human — prompt them to type their statement.
During vote: skip LLM call for human — prompt them to type who they vote for.
build_agent_view() still applies to human — they only see what their role is entitled to see.
NEVER show the human the full GameState (same rule as LLM agents).
```

---

## Definition of Done

A complete game is when:
- [ ] Human gets a random role at start and is told their role + what they can see
- [ ] Human can type day statements and votes interactively
- [ ] LLM NPCs handle all other roles automatically
- [ ] Mafia NPC agent NEVER sees other players' roles in its prompt
- [ ] Detective's private ledger persists across rounds correctly
- [ ] Cross-save scenario (Mafia kills X, Medic saves X) results in no death
- [ ] Win conditions (both Villager and Mafia wins) trigger and halt the graph
- [ ] LangSmith shows clean, nested traces for every game round
- [ ] All `test_engine.py` tests pass with no LLM calls required

---

## Refer To

- `docs/ARCHITECTURE.md` for full technical design
- `docs/GAME_RULES.md` for all edge cases (ties, self-heal, last-stand)
- `docs/AGENT_PROMPTS.md` for all system prompt templates
- `docs/TASKS.md` for the current implementation checklist


---

## How Claude Code Should Behave

**Rule: Challenge the direction**
Think critically before executing. If there's a faster or smarter way to reach the goal, suggest it. Don't just blindly follow — push back when it makes sense.

**Rule: Test before responding**
After any code change, run the relevant tests before saying "done". Never respond with "complete" if the code is untested. For Phase 1-2 tasks, always run `pytest tests/` before confirming.

**Rule: Reduce context usage**
Always look for ways to reduce context window usage. Keep files lean. Remove redundant code or comments. If context is getting too full, suggest a fresh session and recap the current state in TASKS.md first.

**Rule: Explain like I'm new to this**
For every response include:
- **What I just did** — plain English, no jargon
- **What you need to do** — step by step
- **Next step** — one clear action
- **Errors** — if something broke, explain simply and say exactly how to fix it

**Rule: Prompt the next step**
End every response with the next action to take. Example: "Tests passing — ready to start Phase 2, Task 2.1. Should I proceed?" This keeps momentum and prevents losing track.

**Rule: Update TASKS.md after corrections**
If a major correction was made during a session (wrong format, bad assumption, missing step), update TASKS.md or ARCHITECTURE.md to reflect it before closing. This prevents the same mistake next session.

**Rule: One task at a time**
Complete one task from TASKS.md fully (implement + test + commit) before moving to the next. Never work on two tasks simultaneously.