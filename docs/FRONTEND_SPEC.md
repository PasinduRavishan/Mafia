# FRONTEND_SPEC.md — Mafia Game Frontend Design Proposal

> **Status:** Draft for discussion. Not finalized.
> Read this doc, discuss with the team, then lock in decisions before writing any code.

---

## What We're Building

A browser-based game UI that consumes the FastAPI backend.
One human player plays Mafia interactively against LLM-powered NPCs.

The frontend must:
- Start a game and reveal the human's role dramatically
- Show the night phase (dark, tense, limited information)
- Show NPC statements during the day phase in real time
- Let the human type their own statement and cast a vote
- Announce deaths and role reveals with impact
- Show a winner screen with full role reveal

---

## 1. Framework & Tooling Options

### Option A — React + Vite + TypeScript ✅ Recommended
```
npx create vite@latest frontend --template react-ts
```
- Fastest dev server (HMR in <50ms)
- Minimal config — just a game, no SSR needed
- Perfect fit for a real-time interactive single-page app
- Already in the plan (CLAUDE.md Phase 7)

### Option B — Next.js
- Overkill. Server-side rendering adds complexity with no benefit for a game.
- Skip.

**Decision: React + Vite + TypeScript**

---

## 2. Styling Options

### Option A — Tailwind CSS + DaisyUI
- Tailwind for utility classes
- DaisyUI adds pre-built component themes — including a **"night" dark theme** perfect for Mafia
- Zero custom CSS needed for base layout
- Fastest to build

### Option B — Tailwind CSS only (custom components)
- Full control over every pixel
- More work but more unique visual style

### Option C — Styled Components / Emotion
- CSS-in-JS — good for heavily animated, game-feel UIs
- More verbose, harder to maintain

**Recommendation: Tailwind + DaisyUI for base structure, custom CSS for game-specific components (fog effect, card flips, etc.)**

---

## 3. Visual Theme Options

### Theme A — Dark Gothic Village ✅ Best fit
- Black/dark grey background, deep navy for cards
- Amber/orange accent colors (lantern light, fire)
- Serif fonts for headings (Cinzel, Playfair Display — Google Fonts)
- Monospace for log entries (game feels alive, terminal-style)
- Fog/mist effects using CSS blur + opacity layers
- Moon icon in header

**Color palette:**
```
Background:  #0d0d0d (near black)
Card:        #1a1a2e (dark navy)
Accent:      #e8a838 (lantern amber)
Danger:      #c0392b (blood red — Mafia)
Info:        #2980b9 (detective blue)
Success:     #27ae60 (medic green)
Text:        #e8e8e8 (off-white)
Muted:       #7f8c8d (grey)
```

### Theme B — Modern Card Game
- Clean white/dark cards, neon accents
- Feels like Among Us / board game digital port
- Less atmospheric but more polished/modern

### Theme C — Pixel Art / Retro
- Pixel fonts, 8-bit style icons
- Fun but hard to execute cleanly

**Recommendation: Theme A (Dark Gothic Village) — matches the Mafia atmosphere perfectly**

---

## 4. Animation Libraries

### Option A — Framer Motion ✅ Recommended
```bash
npm install framer-motion
```
**What it does:**
- Declarative animations in React (`<motion.div animate={{ opacity: 1 }} />`)
- Page transitions, card flips, slide-ins
- Gesture support (drag, hover, tap)
- Spring physics for natural movement
- Animate presence (elements animate OUT when removed from DOM)

**Best for:**
- Role reveal card flip
- NPC statement bubbles appearing one by one
- Player card death animation (card turns grey, falls)
- Vote result reveal
- Screen-to-screen transitions

### Option B — GSAP (GreenSock Animation Platform)
```bash
npm install gsap
```
**What it does:**
- Professional-grade timeline animations
- Used in AAA game UIs and film industry
- More powerful than Framer Motion for complex sequences
- Steeper learning curve

**Best for:**
- Multi-step cinematic sequences (e.g., narrator speaks → fog rolls in → victim card dims)
- Particle effects

### Option C — React Spring
- Physics-based, good for natural-feeling UI
- Harder API than Framer Motion

### Option D — CSS Animations + Tailwind
- No extra dependency
- Limited to simple keyframe animations
- Good enough for simple transitions

**Recommendation: Framer Motion (easy API, perfect for card/screen transitions) + CSS keyframes for ambient effects (fog, pulse)**

---

## 5. Game-Specific UI Libraries & Assets

### Icons
- **Lucide React** — clean SVG icons (used widely with shadcn)
- **React Icons** — includes Font Awesome, Game Icons
- **Game Icons** (game-icons.net) — thousands of themed SVG icons including daggers, shields, detective hats, wolves — perfect for Mafia roles

### Sound (Optional — Phase 8)
- **Howler.js** — web audio library, easy volume/loop control
- Atmospheric sounds: night crickets, heartbeat before vote reveal, dramatic sting on elimination

### Particles / Atmosphere
- **tsParticles** — canvas particle effects (fireflies, fog, snow)
- **CSS `backdrop-filter: blur()`** — glass morphism cards
- Pure CSS fog: layered `radial-gradient` with `animation: drift`

### Fonts (Google Fonts)
```
Cinzel Decorative  — game title, phase headers
Lora / Merriweather — narrator text (serif, elegant)
Inter / Geist      — UI chrome (clean sans-serif)
JetBrains Mono     — game log entries (monospace terminal feel)
```

---

## 6. User Flow Proposals

---

### Screen 1 — Start / Landing Screen

**What the user sees:**
- Full-screen dark background with subtle fog drift animation
- Game title: **"MAFIA"** in Cinzel Decorative, amber color
- Tagline: *"One village. One wolf. Can you survive the night?"*
- Player count slider: 5 / 6 / 7 / 8
- Big "START GAME" button (amber, glowing pulse animation)
- Loading state: candlelight spinner + "Gathering the villagers..."

**Flow:**
```
User clicks START → POST /game/start → loading spinner → Role Reveal screen
```

---

### Screen 2 — Role Reveal Screen

**What the user sees:**
- A large card, face-down, centered on screen
- Text: *"Your fate has been decided..."*
- Card flips (3D CSS transform, Framer Motion) to reveal role
- Role shown with icon + color:
  - 🔴 MAFIA — red card, wolf icon
  - 🔵 DETECTIVE — blue card, magnifying glass icon
  - 🟢 MEDIC — green card, cross/shield icon
  - ⚪ VILLAGER — white/grey card, house icon
- Private info appears below card:
  - Mafia: *"Your target: eliminate the villagers. Your teammate: [name]"*
  - Detective: *"Your ledger is empty. Investigate wisely."*
  - Medic: *"Protect the innocent. Self-heal available once."*
  - Villager: *"Trust no one. Find the wolf."*
- "I'm Ready" button → Night Phase

---

### Screen 3 — Night Phase Screen

**Two states depending on human's role:**

#### State A: Human has a night action (Mafia / Detective / Medic)
- Background: deep black, no ambient light
- Header: *"Night falls... 🌙 Round [N]"*
- Centered prompt card with role instruction
- Player selection: grid of player name cards (clickable)
  - Each card shows: player name, silhouette icon
  - Hover: subtle amber glow
  - Selected: highlighted border
- Confirm button: *"Make your move"*
- On submit → loading: *"The night passes..."* with fog animation

#### State B: Human is a Villager (no night action)
- Screen goes dark
- Text: *"You close your eyes. The village sleeps..."*
- Log entries animate in one by one:
  - *"The Mafia opens their eyes..."*
  - *"The Detective stirs in the shadows..."*
  - *"The Medic moves quietly through the night..."*
- No interaction — just atmosphere + loading until night resolves

---

### Screen 4 — Narrator Announcement (Dawn)

**What the user sees:**
- Sunrise gradient fade (dark → deep amber)
- Narrator text appears word by word (typewriter effect)
- If death: victim's player card animates (falls/fades/cracks)
- Death card shows: name + role revealed (e.g., *"Ethan — The Detective"*)
- If no death: *"The village wakes to find everyone alive... for now."* (green tint)
- "Continue to Discussion" button

---

### Screen 5 — Day Discussion Screen

**What the user sees:**
- Village square aesthetic (lighter background, amber accents)
- Alive players shown as portrait cards across the top
- Dead players shown smaller, greyed out
- **Speech log** — main panel, scrollable:
  - Each NPC statement appears as a speech bubble with their name
  - Animated in one by one (staggered entrance with Framer Motion)
  - Different bubble colors per role (though roles are hidden — same color for all)
- **Your turn:** text input box at the bottom
  - Placeholder: *"What do you say to the village?"*
  - Character counter
  - Submit button
- After human submits → moves to Vote

---

### Screen 6 — Vote Screen

**What the user sees:**
- Header: *"⚖️ The village must decide. Vote to eliminate a suspect."*
- Player cards laid out in a grid
  - Each card: name, silhouette icon, status (alive/dead)
  - Dead players: greyed out, can't be selected
  - Click to select → card highlights with red border
- Confirm Vote button
- After submit → votes animate in (each NPC vote shown one by one with a sound sting)
- Result: big reveal — eliminated player's card explodes/shatters
- Toast: *"[Name] was a [role]"* — role color-coded

---

### Screen 7 — Game Over Screen

**What the user sees:**

**Village Wins:**
- Green wash, victorious music sting
- *"The village has found their wolf!"*
- All player cards flip over revealing their roles

**Mafia Wins:**
- Red wash, ominous tone
- *"The Mafia controls the village. All is lost."*
- All player cards flip over

Both:
- Full role reveal table: Name | Role | Alive/Dead
- "Play Again" button → back to Start screen

---

## 7. Component Map

```
frontend/
├── src/
│   ├── components/
│   │   ├── screens/
│   │   │   ├── StartScreen.tsx
│   │   │   ├── RoleRevealScreen.tsx
│   │   │   ├── NightScreen.tsx
│   │   │   ├── NarratorScreen.tsx
│   │   │   ├── DiscussionScreen.tsx
│   │   │   ├── VoteScreen.tsx
│   │   │   └── GameOverScreen.tsx
│   │   ├── ui/
│   │   │   ├── PlayerCard.tsx       ← reused everywhere
│   │   │   ├── RoleCard.tsx         ← reveal card with flip
│   │   │   ├── SpeechBubble.tsx     ← NPC statements
│   │   │   ├── GameLog.tsx          ← scrollable public log
│   │   │   ├── NightLog.tsx         ← atmospheric night text
│   │   │   └── VoteResult.tsx       ← vote reveal animation
│   │   └── layout/
│   │       ├── GameHeader.tsx       ← round number, phase, alive count
│   │       └── FogOverlay.tsx       ← ambient CSS fog effect
│   ├── hooks/
│   │   ├── useGameState.ts          ← polling + state management
│   │   └── useGameActions.ts        ← POST wrappers
│   ├── api/
│   │   └── client.ts               ← fetch wrappers for all endpoints
│   ├── types/
│   │   └── game.ts                 ← TypeScript types matching API models
│   └── App.tsx                     ← screen router (useState-based)
```

---

## 8. State Management

Since this is a turn-based game (not real-time), we don't need WebSockets or Redux.

**Simple approach: `useState` + polling**
- `App.tsx` holds `gameState` (the API response)
- After every action → `POST /game/{id}/action` → update state
- While waiting for NPCs → poll `GET /game/{id}/state` every 1s
- Screen shown is determined by `gameState.phase` + `gameState.prompt?.type`

**Screen routing logic:**
```typescript
if (!gameId)               → <StartScreen />
if (showingRoleReveal)     → <RoleRevealScreen />
if (prompt?.type === 'night_action')  → <NightScreen mode="action" />
if (phase === 'night' && !prompt)     → <NightScreen mode="waiting" />
if (prompt?.type === 'day_statement') → <DiscussionScreen />
if (prompt?.type === 'vote')          → <VoteScreen />
if (gameOver)              → <GameOverScreen />
```

---

## 9. Options Summary & Recommendation

| Decision | Options | Recommendation |
|---|---|---|
| Framework | React+Vite, Next.js | **React + Vite + TypeScript** |
| Styling | Tailwind only, Tailwind+DaisyUI, Styled Components | **Tailwind + DaisyUI (night theme)** |
| Animations | Framer Motion, GSAP, CSS only | **Framer Motion + CSS keyframes** |
| Theme | Gothic Village, Modern Card, Pixel Art | **Dark Gothic Village** |
| Icons | Lucide, Game Icons, React Icons | **Lucide + Game Icons** |
| State | Redux, Zustand, useState+polling | **useState + polling** |
| Sound | Howler.js, Web Audio API, none | **None for now (Phase 8 optional)** |

---

## 10. Open Questions for Discussion

1. **Typewriter effect on narrator text** — do you want each word to appear one at a time, or full paragraph fade-in?
2. **NPC discussion** — should each NPC statement appear sequentially with a delay (feels live), or all at once when the screen loads?
3. **Vote reveal** — instant result, or each vote animates in one by one like a game show?
4. **Player silhouettes** — generic shadowed figures, or role-specific icons hidden until death reveals?
5. **Mobile support** — design for desktop first, or responsive from day one?
6. **Sound effects** — minimal atmospheric sounds (optional), or purely visual?
7. **Game log panel** — always visible sidebar showing public_log, or hidden/collapsible?
