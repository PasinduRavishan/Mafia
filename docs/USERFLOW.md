# USERFLOW.md — Mafia Game Frontend: User Flow & Design

> **Status:** Design spec — approved before Phase 7 implementation begins.
> Captures the user's vision + design enhancements for the full game experience.

---

## Finalized Tech Decisions

| Layer | Decision |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS + DaisyUI (night theme) |
| Animations | **GSAP** (GreenSock) — orchestrated timelines |
| Theme | Dark Gothic Village |
| Layout | Round table with player avatars + narrator figure |
| Design | Fully responsive (mobile + desktop) |
| Sound | Atmospheric — crickets, heartbeat, morning birds, vote drumroll |
| Game log | Hidden panel, toggle with a button |
| Role reveal | Spinning 3D card flip |
| Death | Card shatters (GSAP + CSS clip-path or canvas) |
| NPC statements | One-by-one with staggered delay |
| Narrator text | Word-by-word typewriter (GSAP SplitText or custom) |
| Votes | Animate one-by-one, game-show style |
| Player avatars | Generic silhouettes (role hidden until death) |

---

## Core Visual Concept — The Round Table

Every game screen is built around **one persistent scene**: a round village table with:
- **Player avatar seats** arranged in a circle around the table
- **A narrator figure** — a cloaked, lantern-holding silhouette — positioned at the top
- **Ambient effects** — fog drifting behind the table, flickering lanterns at the edges
- **Dynamic lighting** — the entire scene's lighting changes with the game phase (dark at night, warm amber at day)

This table scene never fully disappears. Screens are overlaid on top of it — the table is always the world.

```
                    [ NARRATOR ]
           [P6]                    [P1]

        [P5]        (TABLE)          [P2]

           [P4]                    [P3]

                  [ YOU / HUMAN ]
```

Players are **silhouette cards** — each has:
- Name below the silhouette
- A small status indicator (alive = warm glow, dead = dark/greyed, with a cross)
- A highlight ring when it is their turn to speak or be selected
- Elimination: card shatters on death

---

## Screen-by-Screen User Flow

---

### SCREEN 1 — Landing Page

**Atmosphere:**
- Full-screen dark background
- Slow parallax fog drifts from left to right
- Flickering lanterns at left and right edges (CSS keyframe flicker)
- Distant owl hoot on page load (Howler.js)

**Content:**
- Game title **"MAFIA"** in Cinzel Decorative — amber color, subtle glow pulse
- Tagline (typewriter effect, slower): *"One village. One wolf. Trust no one."*
- Player count selector: pill buttons — 5 / 6 / 7 / 8
- **START GAME** button — amber, large, glowing pulse animation
- On hover: button brightens, soft heartbeat sound starts

**On click START:**
- Button expands to fill screen (GSAP scale animation — curtain wipe)
- Transitions to Role Reveal screen

**Sound:** Cricket ambience loops softly throughout landing page.

---

### SCREEN 2 — Role Reveal

**Purpose:** Dramatically show the human their assigned role.

**Animation sequence (GSAP Timeline):**
1. Black screen fades in — text appears: *"Your fate has been decided..."* (fade in, 1.5s)
2. A card appears face-down in the center (dark wood texture, ornate border)
3. Card spins/flips in 3D (CSS `rotateY` 0° → 180°) — the back becomes the front mid-spin
4. Front of card reveals:
   - Role icon (large, centered)
   - Role name in Cinzel font
   - Role color flashes across the screen (red for Mafia, blue for Detective, etc.)
5. Private info text fades in below the card

**Role-specific card designs:**
| Role | Icon | Color | Sound |
|---|---|---|---|
| 🔴 Mafia | Wolf / dagger silhouette | Deep crimson | Ominous low string sting |
| 🔵 Detective | Magnifying glass | Midnight blue | Mysterious piano note |
| 🟢 Medic | Shield / cross | Forest green | Soft warm chime |
| ⚪ Villager | Lantern / house | Warm grey | Gentle ambient tone |

**Private info shown below card:**
- Mafia: *"Your target: eliminate the village. Teammate(s): [name]"*
- Detective: *"Your ledger is empty. Choose wisely each night."*
- Medic: *"Protect the innocent. You may save yourself once."*
- Villager: *"You know nothing. Watch everyone. Trust no one."*

**CTA:** *"I am ready."* button — amber, appears after card flip completes (0.5s delay).

**On click:** Transition to the main Game Screen (round table fades in).

---

### SCREEN 3 — Game Screen: Round Table (Persistent)

This is the main game scene. All subsequent phases happen on this screen via overlays and animations — the round table is always visible underneath.

**Persistent elements:**
- Round table in center
- Player silhouette cards in their seats
- Narrator cloaked figure at top
- Ambient fog (always drifting, slower at day, thicker at night)
- Phase indicator top-right: Round N | Phase
- Game Log button bottom-right (click to open sliding panel)

**Player card anatomy:**
```
  ┌──────────────┐
  │              │
  │  [silhouette]│  ← generic figure icon
  │              │
  └──────────────┘
      [Name]         ← player name
    ● alive glow     ← warm amber dot when alive / grey X when dead
```

When a player is **selected as a target** (night phase):
- Red pulsing ring around their card
- Card slightly scales up (GSAP scale 1 → 1.08)

When a player **speaks** (day phase):
- Their card gently glows
- Speech bubble appears above their card

---

### SCREEN 4 — Night Phase

The night phase is a full GSAP-orchestrated cinematic sequence.
Every step of the night is visible to the user regardless of their role.

---

#### Step 4.1 — Night Falls (All players)

**GSAP Timeline:**
1. Narrator figure's lantern swings (rotate animation, GSAP)
2. Narrator speech bubble appears with typewriter text:
   *"Night falls over the village. Everyone... close your eyes."*
3. **Eye-close animation:**
   - Two dark panels (top half + bottom half of the screen) slide in from top and bottom
   - They meet in the middle like eyelids closing (GSAP `y` from `-50%` → `0` and `50%` → `0`)
   - Sound: soft whoosh + silence drops in
4. Scene is now fully dark — only the narrator lantern glows faintly
5. Cricket ambience intensifies

---

#### Step 4.2 — Mafia Turn

**All roles see this — perspective differs:**

**Narrator bubble (typewriter):**
*"Mafia... open your eyes. Choose your victim for tonight."*

**Eye-open animation (partial — Mafia only):**
- The dark eyelid panels slide apart just slightly — a narrow slit of dim red light
- Scene tints red at low opacity (evil atmosphere)

**If YOU are Mafia:**
- Eyelids open fully — your seat glows red
- All non-Mafia players' cards are selectable (hover = red ring pulse)
- Narrator bubble: *"Choose one. Who do you eliminate tonight?"*
- User clicks a player avatar → card pulses with red selection ring
- Heartbeat sound plays on hover
- Confirm button appears: *"Confirm Kill"* (red, with knife icon)
- On confirm → card locks in with a final heartbeat thud
- Narrator: *"The Mafia has chosen. Close your eyes."*
- Eyelids close back (GSAP)

**If you are NOT Mafia:**
- Eyelids remain almost closed (narrow slit, dark red tint)
- Narrator bubble visible: *"The Mafia deliberates in the shadows..."*
- After a brief pause, a subtle animation: one of the NPC's cards very faintly pulses (indicating the NPC Mafia is choosing — doesn't reveal who they picked, just that action is happening)
- Narrator: *"The Mafia has chosen. Close your eyes."*
- Eyelids close fully

---

#### Step 4.3 — Detective Turn

**Narrator bubble (typewriter):**
*"Detective... open your eyes. Investigate one player."*

**Eye-open animation:**
- Eyelids slide open with a cold blue light slit
- Scene tints midnight blue

**If YOU are Detective:**
- Eyelids open fully — your seat glows blue
- All other players selectable (hover = blue ring)
- Sound: subtle investigative piano loop
- On click: magnifying glass sweep animation over selected card
- Confirm: *"Investigate"* button
- Result shown privately in a floating card: *"[Name] is MAFIA"* or *"[Name] is INNOCENT"*
  - Red card for Mafia, green for Innocent — fades in with a gasp sound
- Narrator: *"The Detective has seen enough. Close your eyes."*
- Eyelids close

**If you are NOT Detective:**
- Narrow slit, blue tint
- Narrator: *"The Detective studies the shadows..."*
- One NPC card subtly pulses (action happening)
- Narrator: *"The Detective has seen enough. Close your eyes."*
- Eyelids close

---

#### Step 4.4 — Medic Turn

**Narrator bubble (typewriter):**
*"Medic... open your eyes. Choose one soul to protect."*

**Eye-open animation:**
- Green light slit

**If YOU are Medic:**
- Eyelids open fully — green glow on your seat
- All players selectable including yourself (if self-heal not used)
- Hover: soft shield pulse animation on each card
- Sound: gentle warmth chime
- On selection: soft shield glow wraps the chosen card
- Confirm: *"Protect"*
- Narrator: *"The Medic has made their choice. Rest now."*
- Eyelids close

**If you are NOT Medic:**
- Narrow slit, green tint
- NPC Medic card faintly pulses
- Eyelids close

---

#### Step 4.5 — Everyone Wakes Up (Morning)

**GSAP Timeline:**
1. Narrator: *"Everyone... open your eyes."*
2. **Eye-open animation — full and dramatic:**
   - Eyelids slide all the way open
   - Scene transitions from black → deep amber → warm morning gold
   - GSAP: background gradient animates from `#0d0d0d` → `#1a0a00` → `#2d1a00` → `#8b4513` (sunrise)
   - Particles: floating dust motes appear in the morning light (tsParticles or CSS)
   - Sound: crickets fade out → morning birds fade in
3. All player cards regain visibility in warm light

---

### SCREEN 5 — Narrator Morning Announcement

**Scene:** Morning light on the round table. Narrator figure steps forward (subtle GSAP scale).

**Narrator speech bubble (typewriter effect, word by word):**

**If someone died:**
> *"The village woke to find [Name]'s door hanging open... cold and still. [Name] was the [Role]."*

- As the name is spoken: that player's avatar card dims
- Card SHATTERS: GSAP clip-path animation + SVG particle burst
  - Card splits into 10-15 shards that fall off the screen
  - Sound: glass shatter + dramatic orchestral sting
  - Role badge appears briefly on the card before it shatters (if reveal_role_on_death = true)
- Dead player's seat remains — now shows a greyed silhouette with a skull / memorial candle

**If no one died (Medic saved):**
> *"The village woke... and found everyone alive. The Medic's hand was busy last night."*
- Soft golden shimmer across all player cards
- Sound: warm relief chime

**Then:** Narrator: *"Gather now. Speak your truths. Find the wolf among you."*

Scene transitions to morning palette — day discussion begins.

---

### SCREEN 6 — Day Discussion Phase

**Scene:** Warm morning light. All living players visible on the round table.

**Layout:**
- Round table still visible
- Main content area: **conversation feed** (center-bottom panel)
- Player cards around the table are more lit/warm than at night

**NPC Statements — one by one:**
Each NPC speaks in sequence. For each one:
1. That player's card glows (amber ring)
2. Speech bubble floats up above their seat
3. Text appears with typewriter effect inside the bubble (GSAP SplitText or char-by-char)
4. Sound: soft parchment/ambient murmur
5. Bubble fades to the conversation feed at the bottom (slides down)
6. Next player's card lights up

**Conversation feed (bottom panel, scrollable):**
```
 [Oscar]: Losing the detective first night... that's no coincidence.
 [Marco]: I agree. Someone at this table knew who to silence.
 [Nina]:  ...
 [You]:   ← your input appears here
```

**When it's YOUR turn:**
- Your player card glows amber — personal glow ring
- Text input box animates up from the bottom (GSAP `y` slide up)
- Placeholder: *"Speak your truth to the village..."*
- Character counter (150 max)
- Submit button: *"Speak"*
- Sound: soft town-bell chime indicating your turn
- After submit: your statement joins the conversation feed with `[You]:` label

**After all statements:** Narrator bubble appears: *"The village has heard enough. It is time to vote."*

---

### SCREEN 7 — Vote Phase

**Scene:** Same round table. Atmosphere darkens slightly. A vote podium/gavel icon appears at narrator's position.

**Narrator bubble (typewriter):**
*"One among you must go. Vote wisely — the village's fate depends on it."*

**Voting UI:**
- Player cards around the table now have a **vote target ring** on hover
- User clicks a card to select → ring turns red + pulsing
- Confirm Vote button: *"Cast Vote"* — appears after selection
- Sound: drumroll begins softly on hover

**After user votes:**
- Loading state: *"The votes are being counted..."*
- Drumroll intensifies

**Vote Reveal — game show style (GSAP Timeline):**

Each vote flips in one by one:
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  ?  →  Oscar  │  ?  →  Marco  │  ?  →  Oscar  │
└──────────┘     └──────────┘     └──────────┘
  [Carlos]          [Nina]           [You]
```

1. Drumroll builds
2. First vote card flips (CSS 3D rotateY) → reveals voter name + who they voted for
3. 0.8s pause
4. Next vote card flips
5. Repeat for all players
6. Sound: card flip sound on each reveal
7. As votes accumulate, a **vote tally counter** below each player's avatar increments

**Result:**
- Tally finishes → 1 second silence
- Narrator: *"The village has spoken. [Name] is eliminated."*
- That player's card:
  1. Shakes (GSAP shake timeline)
  2. Role badge appears briefly (role reveal)
  3. **SHATTERS** — same shatter animation as night deaths
  4. Sound: dramatic string sting + shatter
- Narrator: *"[Name] was... a [Role]."*
- Role color washes the screen briefly (red = Mafia, etc.)

**Continue:**
- If game not over → Narrator: *"Night falls again..."* → Night Phase begins (Step 4.1)
- If game over → Game Over screen

---

### SCREEN 8 — Game Over

**Village Wins:**
- Golden sunrise floods the screen (GSAP background animate)
- Church bell sounds
- Narrator: *"The wolf has been found! The village is safe... for now."*
- All player cards flip revealing their roles (staggered, one by one)
- Sound: victorious orchestral swell

**Mafia Wins:**
- Red fog floods the screen
- Ominous low drone sound
- Narrator: *"The Mafia controls the village. All hope is lost."*
- Wolf howl sound
- All player cards flip revealing roles (slower, more ominous stagger)

**Both:**
- Full role reveal table animates in below:
```
Name     | Role       | Outcome
---------|------------|--------
Oscar    | Mafia      | Eliminated (Day 1)
Ethan    | Detective  | Killed (Night 1)
You      | Medic      | Survived
...
```
- **"Play Again"** button — glows amber, pulse animation
- On click → fade to black → Landing Page

---

## GSAP Animation Details

### Key GSAP Timelines

**Eye Close/Open (Night Phase entry/exit):**
```javascript
// Close
gsap.timeline()
  .to('.eyelid-top', { y: '50%', duration: 1.2, ease: 'power2.inOut' })
  .to('.eyelid-bottom', { y: '-50%', duration: 1.2, ease: 'power2.inOut' }, '<')
  .to('.scene', { filter: 'brightness(0)', duration: 0.3 })

// Open
gsap.timeline()
  .to('.scene', { filter: 'brightness(1)', duration: 0.5 })
  .to('.eyelid-top', { y: '0%', duration: 1.5, ease: 'power2.inOut' })
  .to('.eyelid-bottom', { y: '0%', duration: 1.5, ease: 'power2.inOut' }, '<')
```

**Card Shatter (Death animation):**
```javascript
// Split card into N shard divs, then animate each
gsap.timeline()
  .to('.player-card-shards', { 
    y: (i) => Math.random() * 300 + 100,
    x: (i) => (Math.random() - 0.5) * 200,
    rotation: (i) => Math.random() * 180,
    opacity: 0,
    duration: 0.8,
    stagger: 0.05,
    ease: 'power2.out'
  })
```

**Typewriter (Narrator text):**
```javascript
// Word by word with SplitText or manual split
const words = text.split(' ')
gsap.timeline()
  .from(words, { opacity: 0, duration: 0.15, stagger: 0.12 })
```

**Staggered NPC Statements:**
```javascript
gsap.from('.speech-bubble', {
  y: 30, opacity: 0, duration: 0.5,
  stagger: 0.3, ease: 'back.out(1.4)'
})
```

**Vote Card Flip:**
```javascript
gsap.timeline()
  .to('.vote-card', {
    rotateY: 90, duration: 0.3, ease: 'power1.in'
  })
  .set('.vote-card', { /* swap content */ })
  .to('.vote-card', {
    rotateY: 0, duration: 0.3, ease: 'power1.out'
  })
```

---

## Sound Design Map

| Moment | Sound | Library |
|---|---|---|
| Landing page | Cricket ambience (loop) | Howler.js |
| Start button hover | Heartbeat begins | Howler.js |
| Role reveal flip | Card whoosh + role-specific sting | Howler.js |
| Night falls | Crickets intensify | Howler.js |
| Eyes close | Soft whoosh + silence | Howler.js |
| Mafia turn | Heartbeat pulse (loop while selecting) | Howler.js |
| Detective turn | Subtle investigative piano | Howler.js |
| Medic turn | Gentle chime | Howler.js |
| Morning / eyes open | Birds fade in | Howler.js |
| Death announcement | Orchestral sting + shatter | Howler.js |
| Day discussion | Soft ambient murmur | Howler.js |
| Your turn to speak | Town bell | Howler.js |
| Vote phase begins | Drumroll (builds) | Howler.js |
| Each vote card flip | Card snap sound | Howler.js |
| Elimination | String sting + shatter | Howler.js |
| Village wins | Victory fanfare + bells | Howler.js |
| Mafia wins | Wolf howl + drone | Howler.js |

---

## Component Architecture

```
frontend/src/
├── components/
│   ├── screens/
│   │   ├── LandingScreen.tsx         ← Fog + title + start button
│   │   ├── RoleRevealScreen.tsx      ← 3D card flip reveal
│   │   └── GameScreen.tsx            ← The round table (persistent host)
│   │
│   ├── game/
│   │   ├── RoundTable.tsx            ← SVG/CSS round table + player seats
│   │   ├── PlayerCard.tsx            ← Silhouette card, glow states, shatter
│   │   ├── NarratorFigure.tsx        ← Cloaked figure + speech bubble
│   │   ├── SpeechBubble.tsx          ← Typewriter text bubble
│   │   └── FogLayer.tsx              ← Animated CSS/tsParticles fog
│   │
│   ├── phases/
│   │   ├── NightPhase.tsx            ← Eyelid animation + role-specific night flow
│   │   ├── MorningReveal.tsx         ← Sunrise + death announcement + shatter
│   │   ├── DiscussionPhase.tsx       ← NPC statements + human text input
│   │   ├── VotePhase.tsx             ← Vote selection + card-flip reveal
│   │   └── GameOverPhase.tsx         ← Winner announcement + role reveal table
│   │
│   └── ui/
│       ├── GameLogPanel.tsx          ← Hidden sliding panel (raw public_log)
│       ├── PhaseIndicator.tsx        ← Round N | Phase badge (top-right)
│       └── VoteTally.tsx             ← Vote count per player during reveal
│
├── hooks/
│   ├── useGame.ts                    ← Core state: gameState, submit action, polling
│   └── useSound.ts                   ← Howler.js wrapper, play/stop/fade
│
├── animations/
│   ├── eyeAnimation.ts               ← GSAP eye open/close timelines
│   ├── shatterAnimation.ts           ← GSAP card shatter
│   ├── typewriterAnimation.ts        ← GSAP word-by-word text
│   └── voteRevealAnimation.ts        ← GSAP vote flip sequence
│
├── api/
│   └── client.ts                     ← fetch wrappers: startGame, submitAction, getState
│
└── types/
    └── game.ts                       ← TypeScript types matching FastAPI response models
```

---

## Screen Routing Logic

```typescript
// App.tsx — screen is determined by game state

type Screen = 'landing' | 'role-reveal' | 'game' | 'game-over'

// Inside game screen, phase determines which overlay is active:
// phase === 'night'  → NightPhase overlay
// phase === 'day'    → DiscussionPhase overlay  (after morning reveal)
// phase === 'vote'   → VotePhase overlay
// game_over === true → GameOverPhase overlay

// Morning reveal triggers when night → day transition detected
// (new narrator entry appears in public_log)
```

---

## Implementation Status

| Component | Status |
|---|---|
| Vite + React + TypeScript scaffold | ✅ Done |
| Tailwind CSS + DaisyUI (custom `mafia` theme) | ✅ Done |
| GSAP installed + animation utilities | ✅ Done |
| Global CSS (fog, eyelids, speech bubbles, shards, flip card) | ✅ Done |
| `types/game.ts` — TypeScript types mirroring API | ✅ Done |
| `api/client.ts` — fetch wrappers | ✅ Done |
| `hooks/useGame.ts` — state + polling + screen routing | ✅ Done |
| `animations/eyeAnimation.ts` — GSAP eyelid close/open | ✅ Done |
| `animations/typewriterAnimation.ts` — word-by-word + char-by-char | ✅ Done |
| `animations/shatterAnimation.ts` — card shatter into falling shards | ✅ Done |
| `LandingScreen` — fog, stars, lanterns, curtain wipe on start | ✅ Done |
| `RoleRevealScreen` — GSAP 3D card flip, color flash, private info | ✅ Done |
| `RoundTable` — SVG round table, player silhouettes, narrator figure | ✅ Done |
| `NarratorBox` — typewriter text box with GSAP entrance | ✅ Done |
| `NightPhase` — eyelid sequence, role slit colors, human picker | ✅ Done |
| `DiscussionPhase` — staggered NPC bubbles, human textarea | ✅ Done |
| `VotePhase` — target grid, confirm, loading state | ✅ Done |
| `GameScreen` — persistent scene, phase overlays, HUD, log panel | ✅ Done |
| `GameOverScreen` — winner reveal, role table, play again | ✅ Done |
| `App.tsx` — screen router wired to useGame hook | ✅ Done |
| Production build — 0 TypeScript errors | ✅ Done |
| Howler.js sounds | 🔜 Phase 8 |
| Vote card flip animation (individual vote reveal) | 🔜 Next |
| Player card shatter on death | 🔜 Next |
| tsParticles fog enhancement | 🔜 Optional |

---

## Open Items (Decided)

| Item | Decision |
|---|---|
| Narrator text style | Word-by-word typewriter (GSAP) |
| NPC statements | One-by-one with staggered delay |
| Vote reveal | Each vote flips one-by-one, game-show style |
| Player avatars | Generic silhouettes — role hidden until death |
| Responsive | Yes — mobile first, desktop enhanced |
| Sound | Atmospheric — crickets, heartbeat, morning birds, vote drumroll |
| Game log | Hidden panel, toggle button (bottom-right) |
| Night waiting | Full cinematic eye-close animation (not just spinner) |
| Role reveal | 3D card spinning flip (GSAP / CSS rotateY) |
| Death animation | Card shatters (GSAP shards fall off screen) |
