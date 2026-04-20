/**
 * NightPhase — Cinematic narrator-led night sequence.
 *
 * ALWAYS plays the FULL sequence (mafia → detective → medic → morning)
 * regardless of the human's role.
 *
 * StrictMode-safe: uses a closure-local `cancelled` flag so that React's
 * development double-invocation doesn't corrupt the sequence. The
 * sequenceStartedRef gate + cleanup reset ensures exactly ONE invocation
 * runs at any given time.
 *
 * Narrator text revealed WORD-BY-WORD for atmosphere.
 * After morning sequence, calls onComplete() so parent can advance.
 */
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { GameStateResponse } from '../../types/game'

interface Props {
  gameState: GameStateResponse
  onSubmit: (target: string) => void
  onComplete: () => void
  loading: boolean
}

// ── Timing config (ms) ─────────────────────────────────────────────
const T = {
  NARRATOR_WORD_MS:  130,   // ms per word in typewriter
  NIGHT_FALLS:      1200,
  CLOSE_EYES_SAY:   1400,
  EYELID_PAUSE:      600,
  ROLE_OPEN_SAY:     900,
  ROLE_QUESTION:    1200,
  NPC_DELIBERATE:   2500,   // NPC "thinking" pause
  HUMAN_CONFIRM:    1200,
  ROLE_CLOSE_SAY:    900,
  BETWEEN_ROLES:     700,
  MORNING_ANNOUNCE: 1000,
  MORNING_OPEN_SAY: 1200,
  DAWN_HOLD:        1800,
}

const TINTS = {
  mafia:     'rgba(192, 57,  43, 0.22)',
  detective: 'rgba( 41, 128, 185, 0.22)',
  medic:     'rgba( 39, 174,  96, 0.22)',
  none:      'transparent',
}

const ROLE_HEX = {
  mafia:     '#c0392b',
  detective: '#2980b9',
  medic:     '#27ae60',
}

export default function NightPhase({ gameState, onSubmit, onComplete, loading }: Props) {
  const humanRole = gameState.your_role
  const options   = gameState.prompt?.options ?? []
  const hasAction = gameState.prompt?.type === 'night_action'

  const [narratorLine, setNarratorLine] = useState('')
  const [statusMsg,    setStatusMsg]    = useState('')
  const [tint,         setTint]         = useState('transparent')
  const [showPicker,   setShowPicker]   = useState(false)
  const [selected,     setSelected]     = useState<string | null>(null)
  const [pickerRole,   setPickerRole]   = useState<'mafia'|'detective'|'medic'>('mafia')
  const [isMorning,    setIsMorning]    = useState(false)
  const [confirmed,    setConfirmed]    = useState(false)
  const [activeRole, setActiveRole] = useState<'mafia'|'detective'|'medic'|null>(null)

  const topRef             = useRef<HTMLDivElement>(null)
  const botRef             = useRef<HTMLDivElement>(null)
  const narBoxRef          = useRef<HTMLDivElement>(null)
  const resolveRef         = useRef<((v: string) => void) | null>(null)
  const sequenceStartedRef = useRef(false)   // prevents double-run in StrictMode

  // ── Full cinematic sequence — StrictMode-safe ───────────────────
  useEffect(() => {
    // StrictMode guard: only allow one active sequence at a time.
    // On StrictMode double-invocation: first run starts → cleanup resets flag
    // → second run starts correctly.
    if (sequenceStartedRef.current) return
    sequenceStartedRef.current = true

    let cancelled = false   // closure-local cancellation flag for this invocation

    // ── Helpers (closure-local so they use the right `cancelled`) ──
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    const say = async (text: string, holdMs: number) => {
      if (cancelled) return
      setStatusMsg('')
      setNarratorLine('')
      await wait(80)
      if (cancelled) return
      const words = text.split(' ')
      let built = ''
      for (let i = 0; i < words.length; i++) {
        if (cancelled) return
        built += (built ? ' ' : '') + words[i]
        setNarratorLine(built)
        if (i === 0 && narBoxRef.current) {
          gsap.fromTo(narBoxRef.current,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
          )
        }
        await wait(T.NARRATOR_WORD_MS)
      }
      if (cancelled) return
      await wait(holdMs)
    }

    const status = (msg: string) => { if (!cancelled) setStatusMsg(msg) }

    const closeEyelids = () => new Promise<void>(res =>
      gsap.timeline({ onComplete: res })
        .to(topRef.current, { y: '0%',    duration: 1.1, ease: 'power2.inOut' })
        .to(botRef.current, { y: '0%',    duration: 1.1, ease: 'power2.inOut' }, '<')
    )

    const openSlit = (pct = 88) => new Promise<void>(res =>
      gsap.timeline({ onComplete: res })
        .to(topRef.current, { y: `-${pct}%`, duration: 1.0, ease: 'power2.inOut' })
        .to(botRef.current, { y:  `${pct}%`, duration: 1.0, ease: 'power2.inOut' }, '<')
    )

    const openFull = () => new Promise<void>(res =>
      gsap.timeline({ onComplete: res })
        .to(topRef.current, { y: '-100%', duration: 1.5, ease: 'power2.inOut' })
        .to(botRef.current, { y:  '100%', duration: 1.5, ease: 'power2.inOut' }, '<')
    )

    const waitHuman = (role: 'mafia'|'detective'|'medic') =>
      new Promise<string>(res => {
        setPickerRole(role)
        setShowPicker(true)
        resolveRef.current = res
      })

    // ── Main cinematic sequence ────────────────────────────────────
    async function runSequence() {

      // ═══ NIGHT FALLS ══════════════════════════════════════════
      await say('Night falls over the village...', T.NIGHT_FALLS)
      await say('Everyone... close your eyes.', T.CLOSE_EYES_SAY)
      if (cancelled) return
      await closeEyelids()
      await wait(T.EYELID_PAUSE)

      // ═══ MAFIA ════════════════════════════════════════════════
      if (cancelled) return
      setTint(TINTS.mafia)
      setActiveRole('mafia')
      if (humanRole === 'mafia') await openSlit(88)

      await say('The Mafia opens their eyes...', T.ROLE_OPEN_SAY)
      await say('Mafia... who will you eliminate tonight?', T.ROLE_QUESTION)

      if (hasAction && humanRole === 'mafia') {
        const target = await waitHuman('mafia')
        if (cancelled) return
        setShowPicker(false)
        status(`You have chosen to eliminate ${target}.`)
        await wait(T.HUMAN_CONFIRM)
        onSubmit(target)
        status('')
      } else {
        status('The Mafia deliberates silently in the darkness...')
        await wait(T.NPC_DELIBERATE)
        status('')
      }

      if (cancelled) return
      await say('Mafia... close your eyes.', T.ROLE_CLOSE_SAY)
      setTint(TINTS.none)
      setActiveRole(null)
      if (humanRole === 'mafia') await closeEyelids()
      await wait(T.BETWEEN_ROLES)

      // ═══ DETECTIVE ════════════════════════════════════════════
      if (cancelled) return
      setTint(TINTS.detective)
      setActiveRole('detective')
      if (humanRole === 'detective') await openSlit(88)

      await say('The Detective opens their eyes...', T.ROLE_OPEN_SAY)
      await say('Detective... who do you investigate tonight?', T.ROLE_QUESTION)

      if (hasAction && humanRole === 'detective') {
        const target = await waitHuman('detective')
        if (cancelled) return
        setShowPicker(false)
        status(`You investigate ${target}...`)
        await wait(T.HUMAN_CONFIRM)
        onSubmit(target)
        status('')
      } else {
        status('The Detective moves silently through the darkness...')
        await wait(T.NPC_DELIBERATE)
        status('')
      }

      if (cancelled) return
      await say('Detective... close your eyes.', T.ROLE_CLOSE_SAY)
      setTint(TINTS.none)
      setActiveRole(null)
      if (humanRole === 'detective') await closeEyelids()
      await wait(T.BETWEEN_ROLES)

      // ═══ MEDIC ════════════════════════════════════════════════
      if (cancelled) return
      setTint(TINTS.medic)
      setActiveRole('medic')
      if (humanRole === 'medic') await openSlit(88)

      await say('The Medic opens their eyes...', T.ROLE_OPEN_SAY)
      await say('Medic... who will you protect tonight?', T.ROLE_QUESTION)

      if (hasAction && humanRole === 'medic') {
        const target = await waitHuman('medic')
        if (cancelled) return
        setShowPicker(false)
        status(`You protect ${target} tonight.`)
        await wait(T.HUMAN_CONFIRM)
        onSubmit(target)
        status('')
      } else {
        status('The Medic quietly moves to protect someone...')
        await wait(T.NPC_DELIBERATE)
        status('')
      }

      if (cancelled) return
      await say('Medic... close your eyes.', T.ROLE_CLOSE_SAY)
      setTint(TINTS.none)
      setActiveRole(null)
      if (humanRole === 'medic') await closeEyelids()
      await wait(T.BETWEEN_ROLES)

      // ═══ MORNING ══════════════════════════════════════════════
      if (cancelled) return
      await say('The night is over.', T.MORNING_ANNOUNCE)
      await say('Everyone... open your eyes.', T.MORNING_OPEN_SAY)
      if (cancelled) return
      setIsMorning(true)
      await openFull()   // Eyes open for ALL roles at morning
      await wait(600)
      await say('Dawn breaks. The village awakens...', T.DAWN_HOLD)

      if (!cancelled) onComplete()
    }

    runSequence()

    return () => {
      // Cancel this invocation and reset the gate so the next mount
      // (StrictMode second-run) can start a fresh sequence.
      cancelled = true
      sequenceStartedRef.current = false
      // Release any pending human-input promise to avoid memory leaks
      if (resolveRef.current) {
        resolveRef.current('')
        resolveRef.current = null
      }
      setShowPicker(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    if (!selected || loading || confirmed) return
    setConfirmed(true)
    resolveRef.current?.(selected)
    resolveRef.current = null
  }

  const pickerColor = ROLE_HEX[pickerRole]
  const pickerLabel =
    pickerRole === 'mafia'     ? '🐺 Choose your target tonight' :
    pickerRole === 'detective' ? '🔍 Who do you investigate?' :
                                 '🛡️ Who do you protect tonight?'

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>

      {/* Color tint overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: tint, transition: 'background 1s ease',
      }} />

      {/* Morning sunrise */}
      {isMorning && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 110%, rgba(139,69,19,0.45) 0%, rgba(60,20,0,0.18) 45%, transparent 70%)',
          animation: 'fadeInUp 3s ease forwards',
        }} />
      )}

      {/* ── Eyelids (z 50, slide in from top + bottom) ─────────── */}
      <div ref={topRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '50vh',
        background: 'linear-gradient(180deg, #010104 80%, #050510)',
        transform: 'translateY(-100%)', zIndex: 50, pointerEvents: 'none',
      }} />
      <div ref={botRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh',
        background: 'linear-gradient(0deg, #010104 80%, #050510)',
        transform: 'translateY(100%)', zIndex: 50, pointerEvents: 'none',
      }} />

      {/* ── Narrator + status — ABOVE eyelids (z 9999) ─────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        padding: '0 1rem 3.5rem',
        display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        {statusMsg && (
          <div style={{
            background: 'rgba(6,6,16,0.92)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '8px 22px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.76rem', color: 'rgba(255,255,255,0.52)',
            letterSpacing: '0.06em',
            animation: 'fadeInUp 0.3s ease forwards',
          }}>
            {statusMsg}
          </div>
        )}

        {narratorLine && (
          <div ref={narBoxRef} style={{
            background: 'rgba(4,4,14,0.96)',
            border: `1px solid ${tint !== 'transparent' ? tint.replace('0.22', '0.6') : 'rgba(232,168,56,0.35)'}`,
            borderRadius: '18px', padding: '14px 24px',
            maxWidth: '500px', width: '100%',
            display: 'flex', gap: '14px', alignItems: 'center',
            boxShadow: '0 4px 30px rgba(0,0,0,0.8)',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>👁</span>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.98rem',
              color: 'rgba(255,255,255,0.92)', fontStyle: 'italic',
              lineHeight: '1.65', margin: 0,
            }}>
              {narratorLine}
            </p>
          </div>
        )}
      </div>

      {/* ── Role-specific night animations ─────────────────────── */}
      {activeRole === 'mafia' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 52, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Stalking shadow figure */}
          <div style={{ position: 'relative', animation: 'float 3s ease-in-out infinite' }}>
            <svg width="90" height="120" viewBox="0 0 90 120" style={{ opacity: 0.55, filter: 'drop-shadow(0 0 18px rgba(192,57,43,0.6))' }}>
              {/* Hooded figure */}
              <path d="M20 120 Q20 72 45 60 Q70 72 70 120Z" fill="#c0392b" opacity="0.7"/>
              <circle cx="45" cy="30" r="18" fill="#1a0505"/>
              <path d="M27 22 Q27 6 45 4 Q63 6 63 22 L63 32 Q54 28 45 28 Q36 28 27 32Z" fill="#2a0808" opacity="0.8"/>
              {/* Glowing red eyes */}
              <circle cx="39" cy="28" r="3" fill="#c0392b" opacity="0.9" style={{ animation: 'lanternFlicker 2s ease-in-out infinite' }}/>
              <circle cx="51" cy="28" r="3" fill="#c0392b" opacity="0.9" style={{ animation: 'lanternFlicker 2.4s ease-in-out infinite', animationDelay: '0.3s' }}/>
              {/* Knife */}
              <path d="M62 68 L68 52 L72 58 L66 74Z" fill="rgba(255,255,255,0.45)"/>
              <rect x="64" y="74" width="4" height="8" rx="1" fill="rgba(255,200,200,0.3)"/>
            </svg>
          </div>
        </div>
      )}
      {activeRole === 'detective' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 52, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'relative' }}>
            {/* Scanning light beam */}
            <div style={{
              position: 'absolute', top: '30px', left: '-80px',
              width: '180px', height: '6px',
              background: 'linear-gradient(90deg, transparent, rgba(41,128,185,0.6), transparent)',
              borderRadius: '3px',
              animation: 'scanBeam 2.2s ease-in-out infinite',
            }} />
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ opacity: 0.65, filter: 'drop-shadow(0 0 14px rgba(41,128,185,0.7))' }}>
              {/* Magnifying glass */}
              <circle cx="40" cy="40" r="28" fill="none" stroke="#2980b9" strokeWidth="5"/>
              <circle cx="40" cy="40" r="22" fill="rgba(41,128,185,0.08)" stroke="rgba(41,128,185,0.3)" strokeWidth="1.5"/>
              {/* Crosshair inside */}
              <line x1="40" y1="26" x2="40" y2="54" stroke="rgba(41,128,185,0.5)" strokeWidth="1.5"/>
              <line x1="26" y1="40" x2="54" y2="40" stroke="rgba(41,128,185,0.5)" strokeWidth="1.5"/>
              {/* Handle */}
              <line x1="62" y1="62" x2="88" y2="88" stroke="#2980b9" strokeWidth="7" strokeLinecap="round"/>
              <line x1="63" y1="63" x2="87" y2="87" stroke="rgba(41,128,185,0.3)" strokeWidth="5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
      {activeRole === 'medic' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 52, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {/* Pulsing healing cross */}
            <div style={{ animation: 'pulse-glow 1.4s ease-in-out infinite' }}>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ opacity: 0.7, filter: 'drop-shadow(0 0 16px rgba(39,174,96,0.8))' }}>
                <rect x="30" y="8"  width="20" height="64" rx="6" fill="#27ae60" opacity="0.85"/>
                <rect x="8"  y="30" width="64" height="20" rx="6" fill="#27ae60" opacity="0.85"/>
              </svg>
            </div>
            {/* Heartbeat line */}
            <svg width="160" height="40" viewBox="0 0 160 40" style={{
              position: 'absolute', bottom: '-30px', left: '50%',
              transform: 'translateX(-50%)',
              opacity: 0.65,
            }}>
              <polyline
                points="0,20 30,20 38,5 46,35 54,8 62,32 70,20 160,20"
                fill="none" stroke="#27ae60" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'pulse-glow 1.4s ease-in-out infinite' }}
              />
            </svg>
          </div>
        </div>
      )}

      {/* ── Human action picker (z 10000, centered right) ──────── */}
      {showPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 2rem', pointerEvents: 'auto',
        }}>
          <div style={{
            background: 'rgba(4,4,16,0.98)', backdropFilter: 'blur(24px)',
            border: `1px solid ${pickerColor}55`,
            borderRadius: '22px', padding: '24px', width: '290px',
            boxShadow: `0 0 60px ${pickerColor}18, 0 24px 60px rgba(0,0,0,0.9)`,
            animation: 'fadeInUp 0.4s ease forwards',
          }}>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.7rem',
              color: pickerColor, textTransform: 'uppercase', letterSpacing: '0.14em',
              margin: '0 0 18px',
            }}>
              {pickerLabel}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: options.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '8px', marginBottom: '16px',
            }}>
              {options.map(pid => {
                const isSel = selected === pid
                return (
                  <button key={pid} onClick={() => setSelected(pid)} style={{
                    padding: '11px 8px', borderRadius: '12px', border: 'none',
                    cursor: confirmed ? 'default' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.82rem', fontWeight: isSel ? 600 : 400,
                    transition: 'all 0.17s ease',
                    background: isSel ? pickerColor : 'rgba(255,255,255,0.06)',
                    color: isSel ? '#fff' : 'rgba(255,255,255,0.7)',
                    boxShadow: isSel ? `0 0 16px ${pickerColor}88` : 'none',
                    transform: isSel ? 'scale(1.05)' : 'scale(1)',
                    pointerEvents: confirmed ? 'none' : 'auto',
                  }}>
                    {pid === 'human' ? 'Yourself' : pid}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selected || loading || confirmed}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                fontFamily: '"Cinzel Decorative", serif', fontWeight: 700, fontSize: '0.88rem',
                color: '#fff',
                cursor: selected && !loading && !confirmed ? 'pointer' : 'not-allowed',
                background: confirmed
                  ? `${pickerColor}cc`
                  : selected ? pickerColor : 'rgba(255,255,255,0.08)',
                opacity: loading && !confirmed ? 0.6 : 1,
                boxShadow: selected ? `0 0 22px ${pickerColor}66` : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {confirmed ? '✓ Locked In' : loading ? 'Confirming...' : 'CONFIRM'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
