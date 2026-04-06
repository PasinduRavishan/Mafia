# API.md — FastAPI Endpoint Specification

> This is the authoritative spec for all FastAPI endpoints.
> Implement against this document. Do not add endpoints not listed here without updating this doc first.

---

## Base URL
```
http://localhost:8000
```

---

## Data Flow Summary

```
POST /game/start
  → Creates game, assigns roles, runs setup_node
  → Returns: game_id + human's role view + first prompt (if human acts at night)

GET /game/{game_id}/state
  → Returns current filtered state for the human player
  → Use to poll for NPC turn results and updated public log

POST /game/{game_id}/action
  → Human submits their turn input (night target / day statement / vote)
  → Resumes LangGraph from interrupt()
  → Returns: updated state + next prompt (or game over)
```

---

## Endpoints

### POST /game/start

Start a new game. Assigns all roles randomly. Human always gets `player_id = "human"`.

**Request body:**
```json
{
  "num_players": 6
}
```
`num_players` is total including human. Min 4, max 10.

**Response `200`:**
```json
{
  "game_id": "uuid-string",
  "your_role": "detective",
  "your_player_id": "human",
  "alive_players": ["human", "player_1", "player_2", "player_3", "player_4", "player_5"],
  "public_log": ["The game has begun. Night falls over the village..."],
  "phase": "night",
  "prompt": {
    "type": "night_action",
    "message": "You are the Detective. Choose one player to investigate tonight.",
    "options": ["player_1", "player_2", "player_3", "player_4", "player_5"]
  },
  "mafia_teammates": null,
  "investigation_ledger": {},
  "medic_self_heal_used": null
}
```

- `prompt` is `null` if it is not the human's turn yet (NPC acts first this phase)
- Role-private fields (`mafia_teammates`, `investigation_ledger`, `medic_self_heal_used`) are `null` unless relevant to the human's role

---

### GET /game/{game_id}/state

Get the current game state filtered for the human player. Call this to see NPC actions that completed while waiting.

**Response `200`:**
```json
{
  "game_id": "uuid-string",
  "round_number": 2,
  "phase": "day",
  "alive_players": ["human", "player_1", "player_3", "player_4"],
  "dead_players": ["player_2", "player_5"],
  "public_log": ["...", "player_2 was found dead this morning."],
  "day_statements": [
    {"player_id": "player_1", "statement": "I think it was player_3..."},
    {"player_id": "player_3", "statement": "Don't look at me, player_4 was suspicious last night."}
  ],
  "prompt": {
    "type": "day_statement",
    "message": "It's your turn to speak. What do you say to the village?",
    "options": null
  },
  "game_over": false,
  "winner": null
}
```

---

### POST /game/{game_id}/action

Human submits their action for the current interrupted turn.

**Request body:**
```json
{
  "type": "night_action",
  "value": "player_3"
}
```

**Action types:**
| `type` | When | `value` |
|---|---|---|
| `night_action` | Human has a night role (Mafia/Detective/Medic) | `player_id` string |
| `day_statement` | Human's turn in day discussion | Free text string (2–4 sentences) |
| `vote` | Vote phase | `player_id` string (must be alive, not self) |

**Response `200`:**
```json
{
  "game_id": "uuid-string",
  "round_number": 2,
  "phase": "vote",
  "alive_players": ["human", "player_1", "player_3", "player_4"],
  "dead_players": ["player_2", "player_5"],
  "public_log": ["...", "You said: I've been watching player_1 carefully..."],
  "day_statements": ["..."],
  "prompt": {
    "type": "vote",
    "message": "Vote: who do you think is Mafia? Choose one player to eliminate.",
    "options": ["player_1", "player_3", "player_4"]
  },
  "game_over": false,
  "winner": null
}
```

**When game ends, response includes:**
```json
{
  "game_over": true,
  "winner": "village",
  "prompt": null,
  "public_log": ["...", "The last Mafia member has been unmasked. The village wins!"]
}
```

**Error `400`:**
```json
{
  "detail": "Invalid action: player_3 is not alive."
}
```

**Error `404`:**
```json
{
  "detail": "Game not found."
}
```

**Error `409`:**
```json
{
  "detail": "Not waiting for human input. NPC turns are in progress."
}
```

---

## Session Storage

Games are stored **in-memory** in a module-level dict in `api/session.py`:

```python
# game_id → LangGraph thread config (checkpointer handles actual state)
GAMES: dict[str, dict] = {}
```

Each game entry holds:
- `thread_id` — passed to LangGraph as `{"configurable": {"thread_id": game_id}}`
- `graph` — the compiled LangGraph instance
- `waiting_for_human` — bool flag so we can reject premature POST /action calls

**Note:** In-memory only — restarting the server wipes all games. Persistence (Redis / DB) is a future enhancement.

---

## Pydantic Models (api/models.py)

```python
class StartGameRequest(BaseModel):
    num_players: int = 6

class ActionRequest(BaseModel):
    type: Literal["night_action", "day_statement", "vote"]
    value: str

class PromptPayload(BaseModel):
    type: str
    message: str
    options: Optional[list[str]]

class GameStateResponse(BaseModel):
    game_id: str
    round_number: int
    phase: str
    alive_players: list[str]
    dead_players: list[str]
    public_log: list[str]
    day_statements: list[dict]
    prompt: Optional[PromptPayload]
    game_over: bool
    winner: Optional[str]
    # Role-private (null if not applicable to human's role)
    your_role: Optional[str]
    mafia_teammates: Optional[list[str]]
    investigation_ledger: Optional[dict]
    medic_self_heal_used: Optional[bool]
```

---

## CORS

For local frontend dev, allow all origins in development:
```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```
Restrict in production.
