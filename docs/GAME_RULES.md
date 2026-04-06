# GAME_RULES.md — Complete Game Logic Reference

> This file is the authoritative reference for all game rules, edge cases, and scenario outcomes.
> The `engine.py` implementation must match every rule in this document exactly.

---

## 1. Roles

### Mafia (Thief)
- **Team:** Mafia (informed minority)
- **Goal:** Eliminate villagers until `mafia_count >= village_count`
- **Night action:** Chooses exactly ONE living player (not themselves) to attempt to kill
- **Private knowledge:** Knows the identities of all other Mafia members
- **Day behavior:** Must blend in as a villager. Can accuse others. Must NOT reveal they are Mafia.

### Villager
- **Team:** Village (uninformed majority)
- **Goal:** Identify and vote out all Mafia members
- **Night action:** None (sleeps)
- **Private knowledge:** None
- **Day behavior:** Must use observation, logic, and social deduction to find Mafia

### Detective (Police)
- **Team:** Village
- **Goal:** Identify Mafia members and guide the village without revealing their identity
- **Night action:** Chooses ONE living player to investigate. Receives a TRUE answer: "Mafia" or "Innocent"
- **Private knowledge:** Their personal investigation ledger (list of investigated players and results)
- **Day behavior:** Has critical information but must share it subtly to avoid being Mafia's next target. Cannot simply announce "I am the Detective and Player X is Mafia" — this would get them killed next round.

### Medic (Doctor)
- **Team:** Village
- **Goal:** Keep key players alive; save those the Mafia targets
- **Night action:** Chooses ONE living player to protect. That player cannot be killed this night.
- **Private knowledge:** Knows who they saved. Does NOT know if the Mafia targeted that person.
- **Self-heal rule:** The Medic CAN protect themselves. This is allowed ONCE per game (configurable). Track with `medic_self_heal_used`.
- **Day behavior:** Acts like a regular villager. Does not reveal their role.

---

## 2. Game Flow

### Phase: Setup
1. Create player list (minimum: 4 players recommended for meaningful gameplay)
2. Assign roles randomly based on game config:
   - Standard 6-player: 1 Mafia, 1 Detective, 1 Medic, 3 Villagers
   - Standard 8-player: 2 Mafia, 1 Detective, 1 Medic, 4 Villagers
3. Assign random personality to each player: `aggressive`, `defensive`, or `analytical`
4. Initialize GameState with round_number=1, all players alive

### Phase: Night (Sequential)
Night actions happen in strict order. No player can see another's night action.

**Step 1 — Mafia action:**
- Mafia agent receives: `[their role, list of mafia teammates, alive players, public_log, round]`
- Mafia agent decides: which player to kill → sets `night_actions.mafia_target`
- Constraint: Cannot target themselves. Cannot target a dead player.
- If multiple Mafia: they must agree on one target (single Mafia setup: just one agent decides)

**Step 2 — Detective action:**
- Detective agent receives: `[their role, investigation_ledger, alive players, public_log, round]`
- Detective agent decides: which player to investigate → sets `night_actions.detective_target`
- System automatically determines alignment of target → updates `detective_ledger`
- Constraint: Cannot investigate themselves. Cannot re-investigate same player (optional rule; default: can re-investigate)

**Step 3 — Medic action:**
- Medic agent receives: `[their role, medic_self_heal_used, alive players, public_log, round]`
- Medic agent decides: which player to protect → sets `night_actions.medic_save`
- Constraint: If `medic_self_heal_used == True`, cannot choose themselves again.

### Phase: Night Resolution (Pure Python)
Computed by `engine.resolve_night_actions()`:

```
IF mafia_target == medic_save:
    death_this_round = None       → "No one died last night"
ELSE:
    death_this_round = mafia_target
    Remove dead player from alive_player_ids
    Add to dead_player_ids
    Update detective_ledger for dead player if investigated
```

### Phase: Narrator Announcement
Narrator LLM generates a story-flavored summary based on resolution result.

**Death occurred:**
> "The village woke to find [Player X]'s house dark and cold. Despite the best efforts of the village healer, they could not be saved. [Player X] has been killed."

**Cross-save (no death):**
> "The village woke relieved — last night's shadows passed without incident. Someone walked away from danger they'll never know they faced."

**Role reveal on death (optional config):**
> "With the morning light, the truth was revealed: [Player X] was a [role]."

### Phase: Day Discussion
All living players discuss who the Mafia might be.

- Controlled by `discussion_turns_left` counter (default: one statement per living player)
- Each agent generates one statement, added to `day_statements` and `public_log`
- Agents reference previous statements and `public_log` to build their arguments
- The `discussion_turns_left` counter decrements each turn. When it reaches 0, discussion ends.

### Phase: Vote
Each living player casts one vote for who they believe is Mafia.

- Agents use `day_statements`, `public_log`, and their private knowledge to decide
- Votes are collected simultaneously (no player sees others' votes before casting)
- `tally_votes()` counts results:
  - Clear majority → that player is eliminated; role is revealed
  - Tie → "Hung Jury" — no one is eliminated this round
- Eliminated player is moved to dead_player_ids

### Phase: Win Check
After vote resolution, check win condition:

```
IF mafia_count == 0:
    winner = "village"
    game_over = True
ELIF mafia_count >= village_count:
    winner = "mafia"
    game_over = True
ELSE:
    Continue to next night
    Reset: night_actions = empty, discussion_turns_left = default, votes = {}
```

---

## 3. Edge Cases & Scenarios

### Scenario A: Cross-Save
- Mafia targets Player 3
- Medic saves Player 3
- **Result:** `resolve_night_actions()` returns `None` → no death → Narrator: "No one died"
- **Note:** Neither the Mafia nor the Medic learns what the other did

### Scenario B: Tie Vote
- Players vote: p1→p3, p2→p4, p3→p3, p4→p4 (2 votes each for p3 and p4)
- **Result:** `tally_votes()` returns `None` → no one eliminated
- **Narrator says:** "The village could not reach a decision. The accused return to their homes."
- Game continues to next night round

### Scenario C: The Last Stand
- 3 living players: 1 Mafia, 2 Villagers
- If village votes wrong → 1 villager dies by vote
- Next night: 2 living players (1 Mafia, 1 Villager) → `mafia_count (1) >= village_count (1)` → MAFIA WINS
- If village votes correctly → Mafia is eliminated → VILLAGE WINS

### Scenario D: Detective Reveals Information
- Detective investigated Mafia member and knows their identity
- Detective must decide: announce directly (risky) or hint subtly (safer)
- If Detective reveals they are the Detective, they likely become Mafia's next night target
- Best strategy: plant suspicion without confirming role ("I have a strong feeling about Player 2...")

### Scenario E: Mafia Accuses Innocent
- Mafia agent falsely accuses a Villager to deflect suspicion
- This is expected and valid behavior
- The Analytical villager personality should notice if accusations lack logical support

### Scenario F: Multiple Mafia Members (8+ player games)
- Mafia members know each other's identity
- Both Mafia agents independently suggest targets during night phase
- System needs consensus: take the most-agreed-upon target, or let agent 1 decide
- **Simple implementation:** Designate one "lead Mafia" who decides; others know the plan

---

## 4. Game Configuration

```python
# Default config for testing (6 players)
DEFAULT_CONFIG = {
    "num_players": 6,
    "num_mafia": 1,
    "has_detective": True,
    "has_medic": True,
    "reveal_role_on_death": True,      # Show role when player is eliminated
    "allow_medic_self_heal": True,     # Medic can protect themselves
    "medic_self_heal_limit": 1,        # Max times per game
    "max_discussion_turns": 1,         # Statements per player per round (keep low for cost)
    "max_rounds": 20,                  # Safety cutoff to prevent infinite games
}
```

---

## 5. Narrator Flavor Text Templates

The Narrator LLM should use these as inspiration for round announcements:

**Night 1 death:**
> "Dawn breaks over a quiet village, but peace was an illusion. [Player X] will not greet this morning..."

**Mid-game death:**
> "Another sleepless night. Another empty seat at the morning table. [Player X] is gone."

**Cross-save:**
> "Something stirred in the night, but the village woke whole. Whatever danger passed has left no mark — at least, none that can be seen."

**Wrong vote:**
> "The village's voice was clear, but justice is not always wise. [Player X], a [role], falls. The true threat watches, and waits."

**Village wins:**
> "The last shadow has been driven from the village. [Mafia player(s)] have been unmasked and removed. The long nightmare is over."

**Mafia wins:**
> "One by one the lights went out. Now the village is silent — not with peace, but with defeat. The Mafia has taken everything."
