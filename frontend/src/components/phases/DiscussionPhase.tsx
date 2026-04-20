/**
 * DiscussionPhase — Narrator-led day discussion.
 *
 * Each speaker is announced by the narrator, then their statement appears
 * WORD BY WORD in a large "currently speaking" box at the bottom of the screen.
 * Their name and completed statement are also pinned above their seat via onBubble.
 * After finishing, their statement moves to a scrollable history panel on the left.
 *
 * Speaking order: NPCs shuffled, human inserted at a random non-first slot.
 * All statements persist on screen after each speaker finishes.
 * onComplete() fires only after every player (NPC + human) has spoken.
 *
 * StrictMode-safe: closure-local `cancelled`; sequenceRanRef resets in cleanup.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import type { DayStatement, GameStateResponse } from '../../types/game'

interface Props {
  gameState: GameStateResponse
  onSubmit: (statement: string) => void
  onBubble: (pid: string, text: string, clearAfterMs: number) => void
  onSpeaker?: (pid: string | null) => void
  onComplete: () => void
  loading: boolean
}

// ── Speed tuning — adjust these to control pacing ──────────────────────
// Increase any value to slow down, decrease to speed up
const D = {
  NAR_WORD_MS:   250,    // ms per word — narrator typewriter (↑ = slower narrator)
  NAR_HOLD:      900,    // ms pause after narrator finishes a line
  WORD_INTERVAL: 250,    // ms per word — player statement typewriter (↑ = slower speech)
  HOLD_AFTER:   1600,    // ms hold on completed statement before moving to next speaker
  GAP_BETWEEN:   950,    // ms gap between speakers
  PERSISTENT_MS: 600000, // how long the head-bubble lingers (don't change)
}

interface CompletedEntry { pid: string; text: string }

export default function DiscussionPhase({
  gameState, onSubmit, onBubble, onSpeaker, onComplete, loading,
}: Props) {
  const [statement, setStatement]   = useState('')
  const [panelOpen, setPanelOpen]   = useState(false)

  // Narrator box state
  const [narText, setNarText]       = useState('')
  const [narVisible, setNarVisible] = useState(false)

  // Currently-speaking box (primary display — word-by-word)
  const [currentSpeaker, setCurrentSpeaker]   = useState<string | null>(null)
  const [currentText, setCurrentText]         = useState('')

  // Accumulated statement history (left panel)
  const [history, setHistory] = useState<CompletedEntry[]>([])

  const isMyTurn = gameState.prompt?.type === 'day_statement'

  // If human is dead, no prompt fires — use day_statements directly (backend already ran everything)
  const humanIsDead = !gameState.alive_players.includes('human')
  const npcStatements: DayStatement[] = humanIsDead
    ? gameState.day_statements.filter(s => s.player_id !== 'human')
    : (gameState.prompt?.npc_statements ?? [])

  const panelRef       = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)
  const narBoxRef      = useRef<HTMLDivElement>(null)
  const speakerBoxRef  = useRef<HTMLDivElement>(null)
  const historyRef     = useRef<HTMLDivElement>(null)
  const mountedRef     = useRef(true)
  const sequenceRanRef = useRef(false)
  const humanDoneRef   = useRef<((text: string) => void) | null>(null)
  const submittedRef   = useRef(false)

  // cancelledRef: only set true on REAL component unmount.
  // The [hasData] cleanup resets sequenceRanRef (for StrictMode) but MUST NOT
  // set this — otherwise the sequence gets killed when gameState updates mid-run
  // (e.g. when human submits and API returns the vote prompt, hasData→false).
  const cancelledRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    cancelledRef.current = false
    return () => {
      mountedRef.current = false
      cancelledRef.current = true   // true unmount — stop any running sequence
    }
  }, [])

  // Start sequence when we have NPC data OR it's the human's turn (no NPCs alive)
  const hasData = npcStatements.length > 0 || (isMyTurn && !humanIsDead)

  useEffect(() => {
    if (!hasData || sequenceRanRef.current) return
    sequenceRanRef.current = true
    // Snapshot NPC data at sequence start — immune to later gameState changes
    const npcSnapshot = [...npcStatements.filter(s => s.player_id !== 'human')]
    const isMyTurnSnapshot = isMyTurn
    const humanIsDeadSnapshot = humanIsDead

    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
    const c = () => cancelledRef.current  // shorthand

    // ── Narrator box: word-by-word ──────────────────────────────────────
    const sayNarrator = async (text: string) => {
      if (c()) return
      setNarText('')
      setNarVisible(true)
      await wait(60)
      const words = text.split(' ')
      let built = ''
      for (let i = 0; i < words.length; i++) {
        if (c()) return
        built += (built ? ' ' : '') + words[i]
        setNarText(built)
        if (i === 0 && narBoxRef.current) {
          gsap.fromTo(narBoxRef.current,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
          )
        }
        await wait(D.NAR_WORD_MS)
      }
      if (c()) return
      await wait(D.NAR_HOLD)
    }

    // ── Player statement: word-by-word in speaker box AND head bubble ───
    const typewriterStatement = async (pid: string, text: string) => {
      if (c()) return
      onSpeaker?.(pid)
      setCurrentSpeaker(pid)
      setCurrentText('')

      await wait(50)
      if (c()) return
      if (speakerBoxRef.current) {
        gsap.fromTo(speakerBoxRef.current,
          { opacity: 0, y: 20, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' }
        )
      }
      await wait(200)
      if (c()) return

      const words = text.split(' ')
      let built = ''
      const typeDuration = words.length * D.WORD_INTERVAL + D.HOLD_AFTER + 10000

      for (const word of words) {
        if (c()) return
        built += (built ? ' ' : '') + word
        setCurrentText(built)
        onBubble(pid, built, typeDuration)
        await wait(D.WORD_INTERVAL)
      }

      if (c()) return
      onBubble(pid, text, D.PERSISTENT_MS)
      await wait(D.HOLD_AFTER)

      if (c()) return
      setHistory(prev => [...prev, { pid, text }])
      setCurrentSpeaker(null)
      setCurrentText('')
      onSpeaker?.(null)
      if (historyRef.current) {
        historyRef.current.scrollTop = historyRef.current.scrollHeight
      }
    }

    // ── Randomise order: shuffle NPCs, insert human at non-first slot ───
    for (let i = npcSnapshot.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[npcSnapshot[i], npcSnapshot[j]] = [npcSnapshot[j], npcSnapshot[i]]
    }
    type Speaker = { player_id: string; statement: string }
    const order: Speaker[] = []
    const humanPos = npcSnapshot.length > 0
      ? Math.floor(Math.random() * npcSnapshot.length) + 1
      : 0
    for (let i = 0; i < npcSnapshot.length; i++) {
      if (i === humanPos) order.push({ player_id: 'human', statement: '' })
      order.push({ player_id: npcSnapshot[i].player_id, statement: npcSnapshot[i].statement })
    }
    if (humanPos >= npcSnapshot.length) order.push({ player_id: 'human', statement: '' })

    // ── Main sequence ────────────────────────────────────────────────────
    async function runSequence() {
      await sayNarrator('The village gathers. It is time to speak.')
      if (c()) return
      setNarVisible(false)
      await wait(300)

      for (const speaker of order) {
        if (c()) return

        if (speaker.player_id === 'human') {
          if (!isMyTurnSnapshot || humanIsDeadSnapshot) continue
          await sayNarrator('The Narrator turns to you. What do you say?')
          if (c()) return
          setNarText('')
          setNarVisible(false)
          setPanelOpen(true)

          const humanText = await new Promise<string>(r => { humanDoneRef.current = r })
          if (c()) return
          setPanelOpen(false)
          if (humanText) {
            await typewriterStatement('human', humanText)
            await wait(D.GAP_BETWEEN)
          }
        } else {
          await sayNarrator(`The Narrator turns to ${speaker.player_id}...`)
          if (c()) return
          setNarText('')
          setNarVisible(false)
          await wait(150)
          await typewriterStatement(speaker.player_id, speaker.statement)
          await wait(D.GAP_BETWEEN)
        }
      }

      // Pause before voting — give the user time to read all statements
      await sayNarrator('The village has spoken. The time for words is over...')
      if (c()) return
      setNarText('')
      setNarVisible(false)
      await wait(5500)

      if (!c()) onComplete()
    }

    runSequence()

    return () => {
      // Reset the guard so StrictMode's remount can restart the sequence.
      // Do NOT touch cancelledRef here — that's only set in the [] unmount effect.
      sequenceRanRef.current = false
      onSpeaker?.(null)
      if (humanDoneRef.current) {
        humanDoneRef.current('')
        humanDoneRef.current = null
      }
    }
  }, [hasData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slide human panel in
  useEffect(() => {
    if (!panelOpen || !panelRef.current) return
    gsap.set(panelRef.current, { x: 320, opacity: 0 })
    gsap.to(panelRef.current, { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' })
    setTimeout(() => inputRef.current?.focus(), 600)
  }, [panelOpen])

  const handleSubmit = useCallback(() => {
    const trimmed = statement.trim()
    if (!trimmed || loading || submittedRef.current || !humanDoneRef.current) return
    submittedRef.current = true
    onSubmit(trimmed)
    setStatement('')
    const done = humanDoneRef.current
    humanDoneRef.current = null
    done(trimmed)
  }, [statement, loading, onSubmit])

  // Display name helper
  const displayName = (pid: string) => pid === 'human' ? 'You' : pid

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>

      {/* Day atmosphere */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse at 50% -8%, rgba(255,210,80,0.22) 0%, rgba(232,168,56,0.08) 35%, transparent 65%)',
          'radial-gradient(ellipse at 20% 0%, rgba(255,180,60,0.08) 0%, transparent 45%)',
          'radial-gradient(ellipse at 80% 0%, rgba(255,180,60,0.08) 0%, transparent 45%)',
        ].join(', '),
      }} />

      {/* Phase label — top left */}
      <div style={{ position: 'absolute', top: '4.5rem', left: '1rem', pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(30,22,5,0.82)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(232,168,56,0.28)',
          borderRadius: '12px', padding: '6px 14px',
        }}>
          <p style={{
            fontFamily: '"Cinzel Decorative", serif', fontSize: '0.63rem',
            color: 'rgba(232,168,56,0.88)', textTransform: 'uppercase',
            letterSpacing: '0.14em', margin: 0,
          }}>
            Round {gameState.round_number} — Discussion
          </p>
        </div>
      </div>

      {/* ── Statement history — LEFT panel ─────────────────────────────── */}
      {history.length > 0 && (
        <div style={{
          position: 'absolute',
          left: '1rem', top: '8rem', bottom: '13rem',
          width: '220px', pointerEvents: 'none',
          display: 'flex', flexDirection: 'column',
          gap: '6px',
          overflow: 'hidden',
        }}>
          <p style={{
            fontFamily: '"Cinzel Decorative", serif', fontSize: '0.56rem',
            color: 'rgba(232,168,56,0.55)', letterSpacing: '0.15em',
            textTransform: 'uppercase', margin: '0 0 4px',
          }}>
            What was said
          </p>
          <div
            ref={historyRef}
            style={{
              flex: 1, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '6px',
              paddingRight: '4px',
            }}
          >
            {history.map((entry, i) => (
              <div key={i} style={{
                background: entry.pid === 'human'
                  ? 'rgba(232,168,56,0.10)'
                  : 'rgba(6,6,18,0.82)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${entry.pid === 'human' ? 'rgba(232,168,56,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '10px', padding: '8px 10px',
                animation: 'fadeInUp 0.4s ease forwards',
              }}>
                <p style={{
                  fontFamily: '"Cinzel Decorative", serif', fontSize: '0.58rem',
                  color: entry.pid === 'human' ? '#e8a838' : 'rgba(255,255,255,0.55)',
                  margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {displayName(entry.pid)}
                </p>
                <p style={{
                  fontFamily: 'Lora, serif', fontSize: '0.72rem',
                  color: 'rgba(255,255,255,0.75)', fontStyle: 'italic',
                  lineHeight: '1.45', margin: 0,
                }}>
                  "{entry.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Narrator box — bottom-right, won't cover bottom player avatar ──── */}
      {narVisible && narText && (
        <div style={{
          position: 'fixed',
          bottom: currentSpeaker ? '14rem' : '1.8rem',
          right: '1.5rem',
          width: 'min(36vw, 400px)', pointerEvents: 'none', zIndex: 8999,
          transition: 'bottom 0.3s ease',
        }}>
          <div ref={narBoxRef} style={{
            background: 'rgba(18,14,4,0.96)', backdropFilter: 'blur(14px)',
            border: '1px solid rgba(232,168,56,0.38)',
            borderRadius: '16px', padding: '11px 18px',
            display: 'flex', gap: '12px', alignItems: 'center',
            boxShadow: '0 0 30px rgba(232,168,56,0.08)',
          }}>
            <span style={{ fontSize: '0.9rem', flexShrink: 0, opacity: 0.75 }}>👁</span>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.88rem',
              color: 'rgba(255,248,220,0.88)', fontStyle: 'italic',
              lineHeight: '1.55', margin: 0,
            }}>
              {narText}
            </p>
          </div>
        </div>
      )}

      {/* ── Currently Speaking box — bottom-right (PRIMARY DISPLAY) ──── */}
      {currentSpeaker && (
        <div style={{
          position: 'fixed',
          bottom: '1.8rem', right: '1.5rem',
          zIndex: 9000,
          pointerEvents: 'none',
        }}>
          <div ref={speakerBoxRef} style={{
            width: 'min(38vw, 460px)',
            background: currentSpeaker === 'human'
              ? 'rgba(30,22,4,0.98)'
              : 'rgba(8,6,20,0.98)',
            backdropFilter: 'blur(20px)',
            border: `2px solid ${currentSpeaker === 'human' ? 'rgba(232,168,56,0.7)' : 'rgba(232,168,56,0.45)'}`,
            borderRadius: '20px', padding: '16px 24px',
            boxShadow: currentSpeaker === 'human'
              ? '0 0 60px rgba(232,168,56,0.18), 0 24px 60px rgba(0,0,0,0.8)'
              : '0 0 40px rgba(232,168,56,0.08), 0 24px 60px rgba(0,0,0,0.8)',
            animation: 'fadeInUp 0.35s ease forwards',
          }}>
            {/* Speaker name row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: currentSpeaker === 'human' ? '#e8a838' : '#e8a838',
                boxShadow: '0 0 8px rgba(232,168,56,0.8)',
                animation: 'pulse-glow 1s ease-in-out infinite',
              }} />
              <p style={{
                fontFamily: '"Cinzel Decorative", serif', fontSize: '0.72rem',
                color: '#e8a838', textTransform: 'uppercase',
                letterSpacing: '0.16em', margin: 0,
              }}>
                {displayName(currentSpeaker)} speaks
              </p>
            </div>

            {/* Typewriter text */}
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '1rem',
              color: 'rgba(255,252,230,0.94)', fontStyle: 'italic',
              lineHeight: '1.7', margin: 0, minHeight: '1.7em',
            }}>
              {currentText ? (
                <>
                  "{currentText}"
                  <span style={{
                    display: 'inline-block', width: '2px', height: '1em',
                    background: '#e8a838',
                    marginLeft: '3px', verticalAlign: 'middle',
                    animation: 'pulse-glow 0.7s ease-in-out infinite',
                  }} />
                </>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'normal', fontSize: '0.8rem' }}>
                  composing...
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Human input panel — right side */}
      {panelOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            right: 0, top: '80px', bottom: 0,
            width: '295px', pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '1rem 1rem 2.5rem 0', zIndex: 30,
          }}
        >
          <div style={{
            background: 'rgba(20,16,4,0.97)', backdropFilter: 'blur(22px)',
            border: '1px solid rgba(232,168,56,0.48)',
            borderRight: 'none', borderRadius: '20px 0 0 20px',
            padding: '20px 18px 18px',
            boxShadow: '-10px 0 50px rgba(0,0,0,0.65), 0 0 40px rgba(232,168,56,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '13px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#e8a838', boxShadow: '0 0 8px #e8a83888',
                animation: 'pulse-glow 1.2s ease-in-out infinite',
              }} />
              <p style={{
                fontFamily: '"Cinzel Decorative", serif', fontSize: '0.67rem',
                color: '#e8a838', textTransform: 'uppercase', letterSpacing: '0.13em', margin: 0,
              }}>
                Your turn to speak
              </p>
            </div>

            <textarea
              ref={inputRef}
              value={statement}
              onChange={e => setStatement(e.target.value.slice(0, 200))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
              }}
              placeholder="Speak your truth to the village..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,220,100,0.04)',
                border: '1px solid rgba(232,168,56,0.18)',
                borderRadius: '12px', padding: '11px 13px',
                fontFamily: 'Lora, serif', fontSize: '0.87rem',
                color: 'rgba(255,248,220,0.92)',
                resize: 'none', outline: 'none', lineHeight: '1.6',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(232,168,56,0.55)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(232,168,56,0.18)' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.22)' }}>
                {statement.length}/200
              </span>
              <button
                onClick={handleSubmit}
                disabled={!statement.trim() || loading}
                style={{
                  padding: '9px 22px', borderRadius: '10px', border: 'none',
                  fontFamily: '"Cinzel Decorative", serif', fontWeight: 700, fontSize: '0.8rem',
                  color: '#0a0802',
                  background: statement.trim() ? '#e8a838' : 'rgba(255,255,255,0.1)',
                  cursor: statement.trim() && !loading ? 'pointer' : 'not-allowed',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: statement.trim() ? '0 0 18px rgba(232,168,56,0.5)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {loading ? '...' : 'SPEAK'}
              </button>
            </div>

            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.6rem',
              color: 'rgba(255,255,255,0.18)', margin: '10px 0 0',
            }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
