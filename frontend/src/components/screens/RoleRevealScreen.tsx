/**
 * RoleRevealScreen — True CSS 3D card flip.
 *
 * Card starts showing MYSTERY side → flips to ROLE side → stays visible.
 * Role-specific SVG avatars: Ninja (mafia), Badge (detective), Cross (medic), Human (villager).
 * All elements start opacity:0 in JSX — GSAP animates in, zero flash.
 */
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { Role, GameStateResponse } from '../../types/game'
import { ROLE_COLORS, ROLE_LABELS, ROLE_TAGLINES } from '../../types/game'

interface Props { gameState: GameStateResponse; onReady: () => void }

const ROLE_BG: Record<Role, string> = {
  mafia:     'radial-gradient(ellipse at 50% 35%, rgba(192,57,43,0.35) 0%, #06060c 65%)',
  detective: 'radial-gradient(ellipse at 50% 35%, rgba(41,128,185,0.35) 0%, #06060c 65%)',
  medic:     'radial-gradient(ellipse at 50% 35%, rgba(39,174,96,0.35)  0%, #06060c 65%)',
  villager:  'radial-gradient(ellipse at 50% 35%, rgba(90,90,110,0.3)   0%, #06060c 65%)',
}

export default function RoleRevealScreen({ gameState, onReady }: Props) {
  const role  = gameState.your_role
  const color = ROLE_COLORS[role]

  const wrapRef      = useRef<HTMLDivElement>(null)
  const promptRef    = useRef<HTMLParagraphElement>(null)
  const cardWrapRef  = useRef<HTMLDivElement>(null)  // the 3D card that rotates
  const glowRef      = useRef<HTMLDivElement>(null)
  const infoRef      = useRef<HTMLDivElement>(null)
  const btnRef       = useRef<HTMLButtonElement>(null)
  const particlesRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    // Wrapper starts invisible — fades in from black (matches LandingScreen fade-out)
    gsap.set(wrapRef.current, { opacity: 0 })
    // All children invisible too
    gsap.set([promptRef.current, infoRef.current, btnRef.current], { opacity: 0, y: 28 })
    gsap.set(cardWrapRef.current,  { opacity: 0, y: 30 })
    gsap.set(glowRef.current,      { opacity: 0, scale: 0.3 })

    const tl = gsap.timeline()

    // 0 — Fade in from black
    tl.to(wrapRef.current, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0)

    // 1 — Prompt fades in
    tl.to(promptRef.current, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.5)

    // 2 — Card drops in (showing MYSTERY side, rotateY=0)
    tl.to(cardWrapRef.current, { opacity: 1, y: 0, duration: 0.75, ease: 'back.out(1.4)' }, 0.7)

    // 3 — Hold a beat to build suspense
    tl.to({}, { duration: 1.3 })

    // 4 — TRUE 3D FLIP: rotateY 0 → 180 (mystery hides, role appears)
    tl.to(cardWrapRef.current, { rotateY: 180, duration: 0.85, ease: 'power2.inOut' })

    // 5 — Color burst
    tl.to(glowRef.current, { opacity: 0.85, scale: 1.6, duration: 0.25, ease: 'power2.out' }, '-=0.1')
    tl.to(glowRef.current, { opacity: 0,    scale: 3.8, duration: 0.8,  ease: 'power2.in'  }, '-=0.05')

    // 6 — Particle burst
    tl.call(() => burstParticles())

    // 7 — Info and button slide in
    tl.to(infoRef.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.5')
    tl.to(btnRef.current,  { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.2')

  }, [])

  function burstParticles() {
    particlesRef.current.forEach((el, i) => {
      if (!el) return
      const angle = (i / particlesRef.current.length) * 360
      const rad   = angle * (Math.PI / 180)
      const dist  = 90 + Math.random() * 60
      gsap.fromTo(el,
        { opacity: 1, scale: 1, x: 0, y: 0 },
        { opacity: 0, scale: 0, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist,
          duration: 0.75 + Math.random() * 0.35, ease: 'power2.out' }
      )
    })
  }

  const handleReady = () => {
    gsap.to(wrapRef.current, {
      opacity: 0, scale: 1.05, duration: 0.45, ease: 'power2.in', onComplete: onReady,
    })
  }

  const ledger = gameState.investigation_ledger
  const ledgerEntries = ledger ? Object.entries(ledger) : []

  return (
    <div ref={wrapRef} style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: ROLE_BG[role],
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Stars */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: (Math.random() * 2.5 + 0.8) + 'px',
          height: (Math.random() * 2.5 + 0.8) + 'px',
          top: Math.random() * 100 + '%', left: Math.random() * 100 + '%',
          borderRadius: '50%', background: '#fff',
          opacity: Math.random() * 0.4 + 0.08,
          animation: `float ${2.5 + Math.random() * 3}s ease-in-out infinite`,
          animationDelay: Math.random() * 4 + 's',
        }} />
      ))}

      {/* Color burst overlay */}
      <div ref={glowRef} style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0,
        background: `radial-gradient(ellipse 65% 50% at 50% 38%, ${color}66 0%, transparent 70%)`,
      }} />

      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '1.3rem', padding: '0 1.5rem', maxWidth: '420px', width: '100%',
      }}>

        {/* Prompt text */}
        <p ref={promptRef} style={{
          fontFamily: 'Lora, serif', fontSize: '1rem',
          color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', textAlign: 'center',
          opacity: 0, margin: 0,
        }}>
          Your fate has been sealed by the shadows...
        </p>

        {/* 3D perspective container */}
        <div style={{ perspective: '1100px' }}>

          {/* Particle burst origin */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 30, pointerEvents: 'none' }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} ref={el => { if (el) particlesRef.current[i] = el }} style={{
                position: 'absolute', width: '7px', height: '7px', borderRadius: '50%',
                background: color, transform: 'translate(-50%, -50%)',
                boxShadow: `0 0 6px ${color}`,
                opacity: 0,
              }} />
            ))}
          </div>

          {/* The card — rotates around Y axis */}
          <div ref={cardWrapRef} style={{
            width: '210px', height: '295px',
            position: 'relative', transformStyle: 'preserve-3d',
            opacity: 0,
          }}>

            {/* ── MYSTERY FACE (shown at rotateY=0) ── */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '18px',
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(148deg, #12122a 0%, #080812 100%)',
              border: '2px solid rgba(232,168,56,0.35)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}>
              {/* Diagonal hatching */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.055,
                background: 'repeating-linear-gradient(45deg, transparent, transparent 9px, rgba(232,168,56,0.8) 9px, rgba(232,168,56,0.8) 10px)',
              }} />
              <CornerOrnament pos="tl" /><CornerOrnament pos="tr" />
              <CornerOrnament pos="bl" /><CornerOrnament pos="br" />
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ fontSize: '3.8rem', opacity: 0.55, lineHeight: 1 }}>🂠</div>
                <div style={{
                  width: '70px', height: '1px', margin: '10px auto',
                  background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.4), transparent)',
                }} />
                <p style={{
                  fontFamily: '"Cinzel Decorative", serif', fontSize: '0.6rem',
                  color: 'rgba(232,168,56,0.55)', letterSpacing: '0.28em', margin: 0,
                }}>MAFIA</p>
              </div>
            </div>

            {/* ── ROLE FACE (shown after rotateY=180) ── */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '18px',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',           // pre-rotated — appears at card's 180°
              background: `linear-gradient(148deg, #0e0e22 0%, #060610 100%)`,
              border: `2px solid ${color}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '10px', padding: '22px',
              boxShadow: `0 0 50px ${color}44, 0 20px 60px rgba(0,0,0,0.9), inset 0 0 40px ${color}08`,
              overflow: 'hidden',
            }}>
              {/* Inner glow rings */}
              <div style={{ position:'absolute', inset:'10px', borderRadius:'14px', border:`1px solid ${color}22`, pointerEvents:'none' }} />
              <div style={{ position:'absolute', inset:'18px', borderRadius:'12px', border:`1px solid ${color}11`, pointerEvents:'none' }} />
              <CornerOrnament pos="tl" color={color} />
              <CornerOrnament pos="tr" color={color} />
              <CornerOrnament pos="bl" color={color} />
              <CornerOrnament pos="br" color={color} />

              {/* Role avatar SVG */}
              <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <RoleAvatar role={role} color={color} />
              </div>

              {/* Role name */}
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <p style={{
                  fontFamily: '"Cinzel Decorative", serif', fontSize: '1.1rem',
                  fontWeight: 700, color, letterSpacing: '0.06em', margin: '0 0 6px',
                  textShadow: `0 0 20px ${color}88`,
                }}>
                  {ROLE_LABELS[role]}
                </p>
                <div style={{
                  height: '1px',
                  background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
                }} />
              </div>

              <p style={{
                fontFamily: 'Lora, serif', fontSize: '0.74rem',
                color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                fontStyle: 'italic', lineHeight: '1.55', zIndex: 1, margin: 0,
              }}>
                {ROLE_TAGLINES[role]}
              </p>
            </div>
          </div>
        </div>

        {/* Private info panel */}
        <div ref={infoRef} style={{
          opacity: 0, width: '100%',
          background: 'rgba(14,14,30,0.88)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '18px', padding: '14px 18px',
          boxShadow: `0 0 0 1px ${color}10 inset`,
        }}>
          {role === 'mafia' && (
            <InfoRow label="Your Pack" value={gameState.mafia_teammates?.join(', ') || 'You hunt alone.'} color="#c0392b" />
          )}
          {role === 'detective' && (
            ledgerEntries.length === 0
              ? <InfoRow label="Investigation Ledger" value="No investigations yet. Stay sharp." color="#2980b9" italic />
              : <>
                  <p style={labelStyle}>Investigation Ledger</p>
                  {ledgerEntries.map(([pid, aln]) => (
                    <p key={pid} style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:'0.78rem', margin:'2px 0', color: aln==='mafia'?'#c0392b':'#27ae60' }}>
                      {pid}: <strong>{aln.toUpperCase()}</strong>
                    </p>
                  ))}
                </>
          )}
          {role === 'medic' && (
            <InfoRow label="Your Ability" value={`Protect one player each night. ${gameState.medic_self_heal_used ? 'Self-heal used.' : 'Self-heal available once.'}`} color="#27ae60" />
          )}
          {role === 'villager' && (
            <InfoRow label="Your Mission" value="Find the Mafia. Vote wisely. Trust no one." color="rgba(255,255,255,0.6)" />
          )}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontFamily:'Inter,sans-serif', fontSize:'0.63rem', color:'rgba(255,255,255,0.2)', margin: 0 }}>
              {gameState.alive_players.map(p => p === 'human' ? 'You' : p).join(' · ')}
            </p>
          </div>
        </div>

        {/* Ready button */}
        <button ref={btnRef} onClick={handleReady} style={{
          opacity: 0, padding: '13px 48px', borderRadius: '999px', border: 'none',
          fontFamily: '"Cinzel Decorative", serif', fontWeight: 700, fontSize: '0.95rem',
          color: '#060610', background: color, cursor: 'pointer',
          boxShadow: `0 0 32px ${color}99, 0 8px 24px rgba(0,0,0,0.5)`,
          animation: 'pulse-glow 2.2s ease-in-out infinite',
          letterSpacing: '0.04em',
        }}>
          I AM READY
        </button>
      </div>
    </div>
  )
}

// ── Role-specific SVG avatars ─────────────────────────────────────────────────

function RoleAvatar({ role, color }: { role: Role; color: string }) {
  switch (role) {
    case 'mafia': return <NinjaAvatar color={color} />
    case 'detective': return <BadgeAvatar color={color} />
    case 'medic': return <MedicAvatar color={color} />
    case 'villager': return <VillagerAvatar color={color} />
  }
}

function NinjaAvatar({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      {/* Body / cloak */}
      <path d="M16 80 Q16 52 40 46 Q64 52 64 80Z" fill={color} opacity="0.85"/>
      {/* Head with mask */}
      <circle cx="40" cy="26" r="14" fill={color} opacity="0.9"/>
      {/* Mask band across eyes */}
      <rect x="26" y="22" width="28" height="7" rx="3" fill="rgba(0,0,0,0.5)"/>
      {/* Glowing eyes */}
      <circle cx="34" cy="25" r="2.5" fill="#fff" opacity="0.9"/>
      <circle cx="46" cy="25" r="2.5" fill="#fff" opacity="0.9"/>
      {/* Hood peak */}
      <path d="M28 14 Q40 4 52 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M26 20 Q26 8 40 6 Q54 8 54 20" fill={color} opacity="0.6"/>
      {/* Kunai / throwing star */}
      <path d="M58 44 L62 48 L58 52 L54 48Z" fill="rgba(255,255,255,0.5)"/>
    </svg>
  )
}

function BadgeAvatar({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      {/* Police star badge — 7 points */}
      <polygon
        points="40,8 44,28 62,22 52,38 70,48 52,50 56,70 40,58 24,70 28,50 10,48 28,38 18,22 36,28"
        fill={color} opacity="0.9"
        stroke={color} strokeWidth="1"
      />
      {/* Inner circle */}
      <circle cx="40" cy="40" r="12" fill="#060610" opacity="0.7"/>
      <circle cx="40" cy="40" r="10" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6"/>
      {/* Center star */}
      <polygon points="40,32 42,38 48,38 43,42 45,48 40,44 35,48 37,42 32,38 38,38" fill={color} opacity="0.8"/>
    </svg>
  )
}

function MedicAvatar({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      {/* Body */}
      <path d="M18 80 Q18 54 40 48 Q62 54 62 80Z" fill={color} opacity="0.7"/>
      {/* Head */}
      <circle cx="40" cy="24" r="14" fill={color} opacity="0.9"/>
      {/* White coat collar */}
      <path d="M30 40 Q30 46 40 46 Q50 46 50 40" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
      {/* Medical cross on body */}
      <rect x="36" y="54" width="8" height="20" rx="2" fill="rgba(255,255,255,0.8)"/>
      <rect x="28" y="62" width="24" height="8"  rx="2" fill="rgba(255,255,255,0.8)"/>
      {/* Mirror / stethoscope */}
      <circle cx="40" cy="24" r="6" fill="rgba(255,255,255,0.15)"/>
      <circle cx="40" cy="24" r="4" fill="rgba(255,255,255,0.08)"/>
      {/* Halo / glow */}
      <circle cx="40" cy="24" r="18" fill="none" stroke={color} strokeWidth="1.5" opacity="0.35"
        style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}/>
    </svg>
  )
}

function VillagerAvatar({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      {/* Shadow / silhouette */}
      <path d="M16 80 Q16 50 40 44 Q64 50 64 80Z" fill={color} opacity="0.6"/>
      <circle cx="40" cy="26" r="14" fill={color} opacity="0.65"/>
      {/* Question mark — they don't know anything */}
      <path d="M35 18 Q35 12 40 12 Q46 12 46 18 Q46 24 40 24 Q40 28 40 30"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="40" cy="34" r="2" fill="rgba(255,255,255,0.5)"/>
      {/* Lantern in hand */}
      <rect x="55" y="52" width="7" height="11" rx="2" fill="rgba(255,255,255,0.15)" stroke={color} strokeWidth="1"/>
      <rect x="57" y="55" width="3" height="6" rx="1" fill={color} opacity="0.6"
        style={{ animation: 'lanternFlicker 2.5s ease-in-out infinite' }}/>
      <line x1="55" y1="52" x2="52" y2="46" stroke={color} strokeWidth="1.5" opacity="0.5"/>
    </svg>
  )
}

// ── Decorative corner ornament ─────────────────────────────────────────────────

function CornerOrnament({ pos, color = 'rgba(232,168,56,0.32)' }: { pos: string; color?: string }) {
  const s: Record<string, React.CSSProperties> = {
    tl: { top:'8px', left:'8px',  transform:'rotate(0deg)' },
    tr: { top:'8px', right:'8px', transform:'rotate(90deg)' },
    bl: { bottom:'8px', left:'8px',  transform:'rotate(270deg)' },
    br: { bottom:'8px', right:'8px', transform:'rotate(180deg)' },
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" style={{ position:'absolute', ...s[pos] }}>
      <path d="M1 14 L1 2 Q1 1 2 1 L14 1" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="1.5" cy="1.5" r="1.5" fill={color} opacity="0.9"/>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: '0.6rem',
  color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
  letterSpacing: '0.18em', margin: '0 0 4px',
}

function InfoRow({ label, value, color, italic }: { label: string; value: string; color: string; italic?: boolean }) {
  return (
    <div>
      <p style={labelStyle}>{label}</p>
      <p style={{ fontFamily: 'Inter, sans-serif', color, fontSize: '0.88rem', margin: 0, fontStyle: italic ? 'italic' : 'normal' }}>
        {value}
      </p>
    </div>
  )
}
