/**
 * GameScreen — Persistent round-table scene with display phase state machine.
 *
 * CRITICAL: The display phase is INDEPENDENT of gameState.phase.
 * The backend phase changes instantly when nodes process, but the frontend
 * needs to play full cinematic sequences before transitioning.
 *
 * Display phase flow per round:
 *   night → narrator → discussion → vote → vote-result → [night (next round) | game-over]
 *
 * gameState is used for DATA (players, logs, statements, votes) but NOT for phase control.
 */
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import gsap from 'gsap'
import RoundTable from '../game/RoundTable'
import NightPhase from '../phases/NightPhase'
import DiscussionPhase from '../phases/DiscussionPhase'
import VotePhase from '../phases/VotePhase'
import type { GameStateResponse } from '../../types/game'

type DisplayPhase = 'night' | 'narrator' | 'discussion' | 'vote' | 'vote-result'

interface Props {
  gameState: GameStateResponse
  onSubmit: (type: string, value: string) => void
  onGameOver: () => void
  loading: boolean
}

const NARRATOR_WORD_MS = 130 // ms per word for narrator typewriter

export default function GameScreen({ gameState, onSubmit, onGameOver, loading }: Props) {
  // ── Display phase state machine ────────────────────────────────────
  // Always starts at 'night' — the cinematic plays regardless of backend phase
  const [displayPhase, setDisplayPhase] = useState<DisplayPhase>('night')
  const [displayRound, setDisplayRound] = useState(1)

  const [logOpen, setLogOpen]              = useState(false)
  const [selectablePlayers, setSelectable] = useState<string[]>([])
  const [selectedPlayer, setSelected]      = useState<string | null>(null)
  const [speechBubbles, setBubbles]        = useState<Record<string, string>>({})
  const [activeSpeaker, setActiveSpeaker]  = useState<string | null>(null)

  // Narrator announce state
  const [narratorText, setNarratorText]       = useState('')
  const [narratorVisible, setNarratorVisible] = useState(false)

  // Detective reveal — lives here (not NightPhase) so it persists after NightPhase unmounts
  const [detectiveReveal, setDetectiveReveal] = useState<string | null>(null)
  const prevLedgerRef  = useRef<Record<string, string>>(gameState.investigation_ledger ?? {})

  useEffect(() => {
    const ledger = gameState.investigation_ledger
    if (!ledger || gameState.your_role !== 'detective') return
    for (const [pid, alignment] of Object.entries(ledger)) {
      if (!prevLedgerRef.current[pid]) {
        prevLedgerRef.current = { ...ledger }
        const isMafia = alignment === 'mafia'
        setDetectiveReveal(
          isMafia
            ? `Your secret oracle: ${pid} is MAFIA 🐺`
            : `Your secret oracle: ${pid} is innocent ✓`
        )
        setTimeout(() => setDetectiveReveal(null), 9000)
        break
      }
    }
  }, [gameState.investigation_ledger, gameState.your_role])

  const logRef         = useRef<HTMLDivElement>(null)
  const cardRefs       = useRef<Record<string, HTMLDivElement | null>>({})
  const bubbleTimers   = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const mountedRef     = useRef(true)
  const narratorBoxRef = useRef<HTMLDivElement>(null)

  // StrictMode-safe: reset to true on every mount, false only on real unmount
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Selectable players from prompt
  useEffect(() => {
    setSelectable(gameState.prompt?.options ?? [])
    setSelected(null)
  }, [gameState.prompt])

  // Clear bubbles and active speaker on display phase change
  useEffect(() => {
    setBubbles({})
    setActiveSpeaker(null)
    Object.values(bubbleTimers.current).forEach(clearTimeout)
    bubbleTimers.current = {}
  }, [displayPhase])

  // Show a speech bubble above a player (auto-clears)
  const showBubble = useCallback((pid: string, text: string, durationMs: number) => {
    setBubbles(prev => ({ ...prev, [pid]: text }))
    if (bubbleTimers.current[pid]) clearTimeout(bubbleTimers.current[pid])
    bubbleTimers.current[pid] = setTimeout(() => {
      setBubbles(prev => { const n = { ...prev }; delete n[pid]; return n })
    }, durationMs)
  }, [])

  // Slide log panel
  const toggleLog = () => {
    const next = !logOpen
    setLogOpen(next)
    gsap.to(logRef.current, { x: next ? '0%' : '100%', duration: 0.4, ease: 'power2.inOut' })
  }

  // activeSpeaker is set by DiscussionPhase during typewriter; falls back to bubble presence
  const speakingPlayer = activeSpeaker ?? (Object.keys(speechBubbles).find(pid => speechBubbles[pid]) ?? null)

  // ── Phase transition callbacks ──────────────────────────────────────

  const handleNightComplete = useCallback(() => {
    if (!mountedRef.current) return
    setDisplayPhase('narrator')
  }, [])

  const handleNarratorComplete = useCallback(() => {
    if (!mountedRef.current) return
    setNarratorVisible(false)
    setNarratorText('')
    setDisplayPhase('discussion')
  }, [])

  const handleDiscussionComplete = useCallback(() => {
    if (!mountedRef.current) return
    setDisplayPhase('vote')
  }, [])

  const handleVoteComplete = useCallback(() => {
    if (!mountedRef.current) return
    setDisplayPhase('vote-result')
  }, [])

  // ── Find narrator text for current display round ────────────────────
  const narratorLine = useMemo(() => {
    return gameState.public_log
      .find(l => l.includes(`[Narrator — Round ${displayRound}]`))
      ?.replace(/\[Narrator.*?\]:\s*/, '').trim()
      || null
  }, [gameState.public_log, displayRound])

  // ── Narrator announce sequence ──────────────────────────────────────
  useEffect(() => {
    if (displayPhase !== 'narrator') return
    if (!narratorLine) return // Wait for data — effect re-runs when narratorLine appears

    let cancelled = false

    async function runNarrator() {
      setNarratorVisible(true)

      // Word-by-word: night result announcement
      const words = narratorLine!.split(' ')
      let built = ''
      for (let i = 0; i < words.length; i++) {
        if (cancelled || !mountedRef.current) return
        built += (built ? ' ' : '') + words[i]
        setNarratorText(built)
        if (i === 0 && narratorBoxRef.current) {
          gsap.fromTo(narratorBoxRef.current,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
          )
        }
        await new Promise(r => setTimeout(r, NARRATOR_WORD_MS))
      }

      // Hold the full text
      await new Promise(r => setTimeout(r, 2500))
      if (cancelled || !mountedRef.current) return

      // Transition line: "discuss among yourselves"
      setNarratorText('')
      await new Promise(r => setTimeout(r, 200))
      if (cancelled || !mountedRef.current) return

      const transitionText = 'Now, the village must discuss and find the Mafia among you.'
      const tWords = transitionText.split(' ')
      let tBuilt = ''
      for (let i = 0; i < tWords.length; i++) {
        if (cancelled || !mountedRef.current) return
        tBuilt += (tBuilt ? ' ' : '') + tWords[i]
        setNarratorText(tBuilt)
        if (i === 0 && narratorBoxRef.current) {
          gsap.fromTo(narratorBoxRef.current,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
          )
        }
        await new Promise(r => setTimeout(r, NARRATOR_WORD_MS))
      }
      await new Promise(r => setTimeout(r, 1800))

      if (!cancelled && mountedRef.current) handleNarratorComplete()
    }

    runNarrator()
    return () => { cancelled = true }
  }, [displayPhase, narratorLine, handleNarratorComplete])

  // ── Vote result handling ────────────────────────────────────────────
  useEffect(() => {
    if (displayPhase !== 'vote-result') return

    const timer = setTimeout(() => {
      if (!mountedRef.current) return
      if (gameState.game_over) {
        onGameOver()
      } else {
        // Next round
        setDisplayRound(prev => prev + 1)
        setDisplayPhase('night')
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [displayPhase, gameState.game_over, onGameOver])

  // Get latest vote result message (last 2 [Vote Result] lines)
  const voteResultMsg = useMemo(() => {
    const lines = gameState.public_log.filter(l => l.includes('[Vote Result]'))
    const latest = lines.slice(-2)
    if (latest.length === 0) return null
    return latest.map(l => l.replace('[Vote Result]:', '').trim()).join(' ')
  }, [gameState.public_log])

  const isDayLike = displayPhase === 'narrator' || displayPhase === 'discussion'
    || displayPhase === 'vote' || displayPhase === 'vote-result'

  return (
    <div className="game-canvas night-gradient relative">

      {/* Ambient fog */}
      <div className="fog-layer" />
      <div className="fog-layer fog-layer-2" />

      {/* Day atmosphere — warm sunlight from above during discussion/narrator/vote */}
      {isDayLike && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            'linear-gradient(180deg, rgba(255,195,60,0.18) 0%, rgba(232,140,30,0.06) 25%, transparent 55%)',
            'radial-gradient(ellipse at 50% 100%, rgba(139,69,19,0.16) 0%, transparent 55%)',
          ].join(', '),
          transition: 'opacity 1.5s ease',
        }} />
      )}

      {/* Round table — always visible */}
      <RoundTable
        gameState={gameState}
        selectedPlayer={selectedPlayer}
        selectablePlayers={selectablePlayers}
        onSelectPlayer={setSelected}
        speakingPlayer={speakingPlayer}
        speechBubbles={speechBubbles}
        cardRefs={cardRefs}
      />

      {/* ── HUD — top bar ──────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-end px-4 pt-4 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="glass-panel rounded-xl px-3 py-2 text-xs">
            <span className="text-medic">●</span>
            <span className="text-white/50 ml-1">{gameState.alive_players.length} alive</span>
            {gameState.dead_players.length > 0 && (
              <><span className="mx-2 text-white/20">·</span><span className="text-white/30">💀 {gameState.dead_players.length}</span></>
            )}
          </div>
          <button
            className="glass-panel rounded-xl px-3 py-2 text-xs font-mono text-accent/70 hover:text-accent pointer-events-auto transition-colors"
            onClick={toggleLog}
          >
            📜 LOG
          </button>
        </div>
      </div>

      {/* Spectator banner for dead human */}
      {!gameState.alive_players.includes('human') && !gameState.game_over && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(6,6,18,0.95)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(192,57,43,0.4)',
            borderRadius: '12px', padding: '8px 22px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '1rem' }}>💀</span>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.65rem',
              color: 'rgba(192,57,43,0.9)', textTransform: 'uppercase',
              letterSpacing: '0.12em', margin: 0,
            }}>You have been eliminated — spectating</p>
          </div>
        </div>
      )}

      {/* ── Phase overlays ─────────────────────────────────────────── */}

      {displayPhase === 'night' && (
        <NightPhase
          key={`night-${displayRound}`}
          gameState={gameState}
          onSubmit={val => onSubmit('night_action', val)}
          onComplete={handleNightComplete}
          loading={loading}
        />
      )}

      {/* ── Narrator announce overlay (between night and discussion) ── */}
      {displayPhase === 'narrator' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
          {/* Morning sunrise glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 110%, rgba(139,69,19,0.35) 0%, rgba(60,20,0,0.14) 45%, transparent 70%)',
          }} />

          {/* Waiting for narrator text — bottom right */}
          {!narratorLine && (
            <div style={{
              position: 'fixed', bottom: '1.8rem', right: '1.5rem', pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(6,6,18,0.85)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '7px 18px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#e8a838', display: 'inline-block',
                  animation: 'pulse-glow 1.4s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)',
                }}>
                  awaiting dawn...
                </span>
              </div>
            </div>
          )}

          {/* Narrator text box — bottom right */}
          {narratorVisible && narratorText && (
            <div style={{
              position: 'fixed', bottom: '1.8rem', right: '1.5rem',
              width: 'min(36vw, 400px)', pointerEvents: 'none',
            }}>
              <div ref={narratorBoxRef} style={{
                background: 'rgba(6,6,16,0.94)', backdropFilter: 'blur(14px)',
                border: '1px solid rgba(232,168,56,0.35)',
                borderRadius: '18px', padding: '14px 20px',
                display: 'flex', gap: '12px', alignItems: 'center',
                boxShadow: '0 0 30px rgba(232,168,56,0.06)',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, opacity: 0.7 }}>🌅</span>
                <p style={{
                  fontFamily: 'Lora, serif', fontSize: '0.92rem',
                  color: 'rgba(255,255,255,0.88)', fontStyle: 'italic',
                  lineHeight: '1.6', margin: 0,
                }}>
                  {narratorText}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {displayPhase === 'discussion' && (
        <DiscussionPhase
          key={`discussion-${displayRound}`}
          gameState={gameState}
          onSubmit={val => onSubmit('day_statement', val)}
          onBubble={showBubble}
          onSpeaker={setActiveSpeaker}
          onComplete={handleDiscussionComplete}
          loading={loading}
        />
      )}

      {displayPhase === 'vote' && (
        <VotePhase
          key={`vote-${displayRound}`}
          gameState={gameState}
          onSubmit={val => onSubmit('vote', val)}
          onBubble={showBubble}
          onComplete={handleVoteComplete}
          loading={loading}
        />
      )}

      {/* ── Vote result overlay ────────────────────────────────────── */}
      {displayPhase === 'vote-result' && voteResultMsg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          animation: 'fadeInUp 0.4s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(8,8,20,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,57,43,0.5)',
            borderRadius: '24px', padding: '36px 48px',
            maxWidth: '520px', textAlign: 'center',
            boxShadow: '0 0 80px rgba(192,57,43,0.15)',
            animation: 'fadeInUp 0.5s ease forwards',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚖️</div>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '1.15rem',
              color: 'rgba(255,255,255,0.92)', fontStyle: 'italic',
              lineHeight: '1.65', margin: 0,
            }}>
              {voteResultMsg}
            </p>
          </div>
        </div>
      )}

      {/* ── Vote result loading (no result text yet) ───────────────── */}
      {displayPhase === 'vote-result' && !voteResultMsg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(8,8,20,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,57,43,0.3)',
            borderRadius: '24px', padding: '36px 48px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚖️</div>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.8rem',
              color: 'rgba(192,57,43,0.7)', letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}>
              Tallying all votes...
            </p>
          </div>
        </div>
      )}

      {/* ── Detective secret oracle reveal (persists across phase changes) ── */}
      {detectiveReveal && (
        <div style={{
          position: 'fixed', top: '5rem', right: '1.5rem',
          zIndex: 500, pointerEvents: 'none',
          animation: 'fadeInUp 0.5s ease forwards',
        }}>
          <div style={{
            background: 'rgba(4,8,30,0.98)', backdropFilter: 'blur(20px)',
            border: '2px solid rgba(41,128,185,0.6)',
            borderRadius: '16px', padding: '14px 22px',
            maxWidth: '320px',
            boxShadow: '0 0 50px rgba(41,128,185,0.2), 0 16px 40px rgba(0,0,0,0.85)',
          }}>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.55rem',
              color: 'rgba(41,128,185,0.7)', textTransform: 'uppercase',
              letterSpacing: '0.18em', margin: '0 0 7px',
            }}>
              🔍 Secret Oracle
            </p>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.92rem',
              color: 'rgba(255,255,255,0.92)', fontStyle: 'italic',
              lineHeight: '1.55', margin: 0,
            }}>
              {detectiveReveal}
            </p>
          </div>
        </div>
      )}

      {/* ── Sliding log panel ──────────────────────────────────────── */}
      <div
        ref={logRef}
        className="absolute top-0 right-0 bottom-0 w-80 z-40 flex flex-col"
        style={{ transform: 'translateX(100%)' }}
      >
        <div className="glass-panel h-full flex flex-col rounded-l-2xl overflow-hidden"
          style={{ background: 'rgba(8,8,20,0.96)', borderLeft: '1px solid rgba(232,168,56,0.18)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="font-cinzel text-accent text-sm">Game Log</span>
            <button onClick={toggleLog} className="text-white/40 hover:text-white text-lg">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {gameState.public_log
              .filter(l => !l.startsWith('__') && l.trim())
              .map((line, i) => (
                <p key={i} className="font-mono text-xs text-white/45 leading-relaxed border-b border-white/5 pb-1">
                  {line.trim()}
                </p>
              ))}
          </div>
        </div>
      </div>

      {/* Log backdrop */}
      {logOpen && (
        <div className="absolute inset-0 z-30 bg-black/40" onClick={toggleLog} />
      )}
    </div>
  )
}
