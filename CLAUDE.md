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
│   └── TASKS.md                ← Implementation task list with status
├── src/
│   ├── state.py                ← GameState TypedDict definition (build first)
│   ├── engine.py               ← Pure Python game logic (no LLM)
│   ├── graph.py                ← LangGraph StateGraph wiring
│   ├── nodes/
│   │   ├── setup_node.py
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
│       ├── state_views.py      ← build_agent_view() - information isolation
│       └── logging.py          ← LangSmith tagging helpers
├── tests/
│   ├── test_engine.py          ← Pure Python logic tests (no LLM needed)
│   ├── test_state_views.py     ← Information isolation tests
│   └── test_integration.py    ← Full game round tests
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

## Tech Stack (Pinned Versions)

| Package | Version | Purpose |
|---|---|---|
| `langgraph` | `>=0.2.0` | Graph orchestration |
| `langchain-anthropic` | `>=0.3.0` | Claude as agent LLM |
| `langchain-core` | `>=0.3.0` | Base types, messages |
| `langsmith` | `>=0.2.0` | Tracing & observability |
| `pydantic` | `>=2.0` | Data validation for inputs/outputs |
| Python | `>=3.11` | f-strings, TypedDict, match statements |

LLM Model for all agents: `claude-sonnet-4-6` (balance of speed + quality)

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

**Phase 1 — Foundation (No LLM)**
Build and fully test: `state.py` → `engine.py` → `state_views.py` → `test_engine.py`

**Phase 2 — Graph Skeleton**
Wire: `graph.py` with all nodes stubbed → connect edges → verify graph compiles

**Phase 3 — Night Phase Agents**
Build agents one at a time: Mafia → Detective → Medic
Test each night phase end-to-end before proceeding.

**Phase 4 — Day Phase**
Build: `narrator_node.py` → `day_discussion_node.py` → `vote_node.py`
This is the hardest phase. Use `discussion_turns_left` to bound loops.

**Phase 5 — Full Game Loop**
Wire win_check → loop back or END
Run 5 complete games, verify win conditions trigger correctly.

**Phase 6 — Observability**
Add LangSmith tags, metadata, and game_round tracking to all nodes.

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