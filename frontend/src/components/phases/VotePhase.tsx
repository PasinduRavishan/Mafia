/**
 * VotePhase — Narrator-led voting ceremony.
 *
 * NPC votes are already in public_log when this component mounts.
 * The ceremony calls each NPC in RANDOM order, reveals their vote with a
 * typewriter bubble, updates the running tally, then asks the human last.
 *
 * StrictMode-safe: closure-local `cancelled` flag; ceremonyRef resets in cleanup.
 * Vote parsing restricted to the CURRENT ROUND's vote block to avoid
 * picking up stale entries from earlier rounds.
 */
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameStateResponse } from '../../types/game'

interface Props {
  gameState: GameStateResponse
  onSubmit: (target: string) => void
  onBubble: (pid: string, text: string, clearMs: number) => void
  onComplete: () => void
  loading: boolean
}

const V = {
  NARRATOR_WORD_MS: 130,
  INTRO_1:         1600,
  INTRO_2:         1200,
  CALL_ANNOUNCE:   1000,
  VOTE_REVEAL:     2500,
  AFTER_VOTE:      1200,
  HUMAN_ANNOUNCE:  1400,
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

type CeremonyStep = 'waiting' | 'intro' | 'revealing' | 'human-turn' | 'submitted'

export default function VotePhase({ gameState, onSubmit, onBubble, onComplete, loading }: Props) {
  const options = gameState.prompt?.options ?? []

  const [step, setStep]            = useState<CeremonyStep>('waiting')
  const [selected, setSelected]    = useState<string | null>(null)
  const [narText, setNarText]      = useState('')
  const [currentCaller, setCaller] = useState<string | null>(null)
  const [tally, setTally]          = useState<Record<string, number>>({})
  // voter → target log (for per-voter display)
  const [voteLog, setVoteLog]      = useState<Array<{ voter: string; target: string }>>([])

  const panelRef    = useRef<HTMLDivElement>(null)
  const narBoxRef   = useRef<HTMLDivElement>(null)
  const mountedRef  = useRef(true)
  const ceremonyRef = useRef(false)

  // StrictMode-safe mounted flag
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Support dead human: parse from log too
  const logNpcVotes: Record<string, string> = {}
  {
    const log = gameState.public_log
    let blockStart = -1
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].includes('--- Votes cast ---')) { blockStart = i; break }
    }
    if (blockStart >= 0) {
      for (const line of log.slice(blockStart)) {
        const m = line.match(/^\s+(.+?) votes for (.+)$/)
        if (m && m[1].trim() !== 'You') {
          logNpcVotes[m[1].trim()] = m[2].trim()
        }
      }
    }
  }

  const humanIsDead = !gameState.alive_players.includes('human')
  const npcVotes: Record<string, string> = humanIsDead ? logNpcVotes : (gameState.prompt?.npc_votes ?? {})
  const hasVoteData = gameState.prompt?.type === 'vote' || (humanIsDead && Object.keys(logNpcVotes).length > 0)

  // ── Start ceremony when vote data arrives ─────────────────────────────
  useEffect(() => {
    if (!hasVoteData || ceremonyRef.current) return
    ceremonyRef.current = true
    let cancelled = false

    // say() is defined here so it captures the same `cancelled` flag
    const say = async (text: string, holdMs: number) => {
      if (cancelled) return
      setNarText('')
      await delay(80)
      if (cancelled) return
      const words = text.split(' ')
      let built = ''
      for (let i = 0; i < words.length; i++) {
        if (cancelled) return
        built += (built ? ' ' : '') + words[i]
        setNarText(built)
        if (i === 0 && narBoxRef.current) {
          gsap.fromTo(narBoxRef.current,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
          )
        }
        await delay(V.NARRATOR_WORD_MS)
      }
      if (cancelled) return
      await delay(holdMs)
    }

    // Snapshot alive NPCs at ceremony start and shuffle for random call order
    const npcs = gameState.alive_players
      .filter(p => p !== 'human')
      .slice() // copy
    for (let i = npcs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[npcs[i], npcs[j]] = [npcs[j], npcs[i]]
    }

    async function runCeremony() {
      setStep('intro')
      await say('The time has come for the village to cast its judgement.', V.INTRO_1)
      if (cancelled) return
      await say('The Narrator calls upon each villager, one by one.', V.INTRO_2)
      if (cancelled) return
      setNarText('')

      setStep('revealing')
      const runningTally: Record<string, number> = {}

      for (const npc of npcs) {
        if (cancelled) return
        setCaller(npc)
        await say(`The Narrator turns to ${npc}...`, V.CALL_ANNOUNCE)
        if (cancelled) return

        const vote = npcVotes[npc]
        if (vote) {
          onBubble(npc, `🗳️ I vote for ${vote}`, 600000)
          runningTally[vote] = (runningTally[vote] ?? 0) + 1
          setTally({ ...runningTally })
          setVoteLog(prev => [...prev, { voter: npc, target: vote }])
          await delay(V.AFTER_VOTE)
        } else {
          onBubble(npc, '🤔 (abstains)', 600000)
          await delay(V.AFTER_VOTE)
        }
        if (cancelled) return
        setCaller(null)
      }

      if (cancelled) return

      if (humanIsDead) {
        // Dead human just watches — auto complete
        if (!cancelled) onComplete()
        return
      }

      setStep('human-turn')
      await say('And now... the Narrator looks to YOU.', V.HUMAN_ANNOUNCE)
      if (cancelled) return
      await say('Who do you accuse of being Mafia?', 1200)
      if (cancelled) return
      setNarText('')
    }

    runCeremony()

    return () => {
      cancelled = true
      ceremonyRef.current = false
    }
  }, [hasVoteData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Slide panel in when human-turn starts
  useEffect(() => {
    if (step !== 'human-turn' || !panelRef.current) return
    gsap.set(panelRef.current, { x: 320, opacity: 0 })
    gsap.to(panelRef.current, { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' })
  }, [step])

  const handleVote = () => {
    if (!selected || loading || step === 'submitted') return
    setStep('submitted')
    setNarText(`The village has accused ${selected}. Counting all votes...`)
    onBubble('human', `🗳️ I vote for ${selected}`, 600000)
    setVoteLog(prev => [...prev, { voter: 'You', target: selected }])
    onSubmit(selected)
  }

  // After vote submitted and API responds → signal parent
  useEffect(() => {
    if (step !== 'submitted' || loading) return
    const timer = setTimeout(() => {
      if (mountedRef.current) onComplete()
    }, 2500)
    return () => clearTimeout(timer)
  }, [step, loading, onComplete])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>

      {/* Vote tension tint */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(192,57,43,0.12) 0%, transparent 55%)',
      }} />

      {/* Phase label */}
      <div style={{ position: 'absolute', top: '4.5rem', left: '1rem', pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(20,6,6,0.80)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(192,57,43,0.28)',
          borderRadius: '12px', padding: '6px 14px',
        }}>
          <p style={{
            fontFamily: '"Cinzel Decorative", serif', fontSize: '0.63rem',
            color: 'rgba(192,57,43,0.88)', textTransform: 'uppercase',
            letterSpacing: '0.14em', margin: 0,
          }}>
            Round {gameState.round_number} — Vote
          </p>
        </div>
      </div>

      {/* Waiting indicator */}
      {step === 'waiting' && (
        <div style={{
          position: 'absolute', bottom: '3rem', left: '50%',
          transform: 'translateX(-50%)', pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(6,6,18,0.8)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px', padding: '7px 18px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#c0392b', display: 'inline-block',
              animation: 'pulse-glow 1.4s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)',
            }}>
              preparing the vote...
            </span>
          </div>
        </div>
      )}

      {/* Vote tally + voter log — LEFT side (avoids overlapping human vote panel on right) */}
      {(Object.keys(tally).length > 0 || voteLog.length > 0) && (
        <div style={{
          position: 'absolute', top: '8rem', left: '1rem',
          animation: 'fadeInUp 0.4s ease forwards', pointerEvents: 'none',
          maxWidth: '200px', zIndex: 25,
        }}>
          <div style={{
            background: 'rgba(6,6,18,0.95)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(192,57,43,0.3)',
            borderRadius: '14px', padding: '12px 14px',
          }}>
            {/* Count bars */}
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.58rem',
              color: 'rgba(192,57,43,0.85)', letterSpacing: '0.15em',
              textTransform: 'uppercase', margin: '0 0 8px',
            }}>
              Vote Tally
            </p>
            {Object.entries(tally)
              .sort(([, a], [, b]) => b - a)
              .map(([pid, count]) => {
                const maxVotes = Math.max(...Object.values(tally))
                const barW = Math.round((count / maxVotes) * 70)
                return (
                  <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                    <div style={{
                      height: '4px', borderRadius: '2px', background: '#c0392b',
                      width: `${barW}px`, transition: 'width 0.5s ease',
                      boxShadow: '0 0 6px rgba(192,57,43,0.5)', flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.73rem', color: 'rgba(255,255,255,0.78)' }}>
                      {pid} <strong style={{ color: '#c0392b' }}>×{count}</strong>
                    </span>
                  </div>
                )
              })}

            {/* Per-voter log */}
            {voteLog.length > 0 && (
              <>
                <div style={{
                  height: '1px', background: 'rgba(192,57,43,0.2)',
                  margin: '9px 0 8px',
                }} />
                <p style={{
                  fontFamily: '"Cinzel Decorative", serif', fontSize: '0.56rem',
                  color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em',
                  textTransform: 'uppercase', margin: '0 0 6px',
                }}>
                  Votes Cast
                </p>
                {voteLog.map(({ voter, target }, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    marginBottom: '4px',
                    animation: 'fadeInUp 0.3s ease forwards',
                  }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: '0.7rem',
                      color: voter === 'You' ? '#e8a838' : 'rgba(255,255,255,0.65)',
                      fontWeight: voter === 'You' ? 600 : 400,
                    }}>
                      {voter}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.6rem' }}>→</span>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: '0.7rem',
                      color: '#c0392b', fontWeight: 600,
                    }}>
                      {target}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Narrator box — bottom centre */}
      {narText && (
        <div style={{
          position: 'absolute', bottom: '4rem', left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(88vw, 470px)', pointerEvents: 'none',
        }}>
          <div ref={narBoxRef} style={{
            background: 'rgba(6,6,18,0.95)', backdropFilter: 'blur(14px)',
            border: '1px solid rgba(192,57,43,0.35)',
            borderRadius: '18px', padding: '13px 20px',
            display: 'flex', gap: '12px', alignItems: 'center',
            boxShadow: '0 0 30px rgba(192,57,43,0.06)',
          }}>
            <span style={{ fontSize: '0.95rem', flexShrink: 0, opacity: 0.7 }}>⚖️</span>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.94rem',
              color: 'rgba(255,255,255,0.88)', fontStyle: 'italic',
              lineHeight: '1.6', margin: 0,
            }}>
              {narText}
            </p>
          </div>
        </div>
      )}

      {/* Calling upon indicator — bottom left */}
      {currentCaller && (
        <div style={{
          position: 'absolute', bottom: '2rem', left: '1rem',
          animation: 'fadeInUp 0.3s ease forwards', pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(6,6,18,0.85)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '6px 14px',
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.42)',
          }}>
            ⚖️ Calling upon {currentCaller}...
          </div>
        </div>
      )}

      {/* Human vote panel — right side */}
      {step === 'human-turn' && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            right: 0, top: '80px', bottom: 0,
            width: '305px', pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '1rem 1rem 2.5rem 0',
          }}
        >
          <div style={{
            background: 'rgba(6,6,20,0.98)', backdropFilter: 'blur(22px)',
            border: '1px solid rgba(192,57,43,0.42)',
            borderRight: 'none',
            borderRadius: '20px 0 0 20px',
            padding: '22px 18px',
            boxShadow: '-10px 0 50px rgba(0,0,0,0.8), 0 0 30px rgba(192,57,43,0.06)',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{
                fontFamily: '"Cinzel Decorative", serif', fontSize: '0.68rem',
                color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.14em',
                margin: '0 0 4px',
              }}>
                ⚖️ Cast your vote
              </p>
              <p style={{
                fontFamily: 'Lora, serif', fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.42)', fontStyle: 'italic', margin: 0,
              }}>
                Who do you accuse of being Mafia?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '16px' }}>
              {options.map(pid => {
                const isSel  = selected === pid
                const count  = tally[pid] ?? 0
                return (
                  <button key={pid} onClick={() => setSelected(pid)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 13px', borderRadius: '12px', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    background: isSel ? 'rgba(192,57,43,0.22)' : 'rgba(255,255,255,0.05)',
                    outline: isSel ? '1px solid rgba(192,57,43,0.65)' : '1px solid transparent',
                    transition: 'all 0.18s ease',
                    transform: isSel ? 'scale(1.02)' : 'scale(1)',
                  }}>
                    <svg viewBox="0 0 30 42" width="22"
                      fill={isSel ? '#c0392b' : 'rgba(255,255,255,0.3)'}>
                      <circle cx="15" cy="10" r="7"/>
                      <path d="M3 42 Q3 26 15 24 Q27 26 27 42Z"/>
                    </svg>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif', fontSize: '0.86rem',
                        fontWeight: isSel ? 600 : 400,
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.75)',
                        margin: 0,
                      }}>
                        {pid}
                      </p>
                      {count > 0 && (
                        <p style={{
                          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem',
                          color: 'rgba(192,57,43,0.75)', margin: '1px 0 0',
                        }}>
                          {count} vote{count > 1 ? 's' : ''} so far
                        </p>
                      )}
                    </div>
                    {isSel && <span style={{ color: '#c0392b', fontSize: '0.8rem' }}>●</span>}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleVote}
              disabled={!selected || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                fontFamily: '"Cinzel Decorative", serif', fontWeight: 700, fontSize: '0.84rem',
                color: '#fff',
                cursor: selected && !loading ? 'pointer' : 'not-allowed',
                background: selected ? 'linear-gradient(135deg, #c0392b, #8e1a10)' : 'rgba(255,255,255,0.08)',
                opacity: loading ? 0.6 : 1,
                boxShadow: selected ? '0 0 24px rgba(192,57,43,0.5)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? 'Counting...' : selected ? `ACCUSE ${selected.toUpperCase()}` : 'SELECT A SUSPECT'}
            </button>
          </div>
        </div>
      )}

      {/* Submitted state */}
      {step === 'submitted' && !narText && (
        <div style={{
          position: 'absolute', bottom: '4rem', left: '50%',
          transform: 'translateX(-50%)',
          animation: 'fadeInUp 0.5s ease forwards', pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(6,6,18,0.97)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(192,57,43,0.35)',
            borderRadius: '18px', padding: '20px 32px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚖️</div>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.76rem',
              color: '#c0392b', letterSpacing: '0.14em', textTransform: 'uppercase',
              margin: '0 0 5px',
            }}>
              Tallying all votes...
            </p>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', margin: 0,
            }}>
              The village has spoken.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
