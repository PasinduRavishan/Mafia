import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface Props {
  onStart: (numPlayers: number) => void
  loading: boolean
}

const AMBER   = '#e8a838'
const DARK_BG = '#0d0d0d'
const CARD_BG = '#1a1a2e'

export default function LandingScreen({ onStart, loading }: Props) {
  const [numPlayers, setNumPlayers] = useState(6)
  const [clicked, setClicked] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef     = useRef<HTMLHeadingElement>(null)
  const taglineRef   = useRef<HTMLParagraphElement>(null)
  const pillsRef     = useRef<HTMLDivElement>(null)
  const btnRef       = useRef<HTMLButtonElement>(null)
  const lanternL     = useRef<HTMLDivElement>(null)
  const lanternR     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Set initial states synchronously — no flash possible
    gsap.set([lanternL.current, lanternR.current], { opacity: 0, y: -20 })
    gsap.set(titleRef.current,   { opacity: 0, y: -30 })
    gsap.set(taglineRef.current, { opacity: 0, y: 15 })
    gsap.set(pillsRef.current,   { opacity: 0, y: 15 })
    gsap.set(btnRef.current,     { opacity: 0, y: 15 })

    // Animate TO visible
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.to([lanternL.current, lanternR.current], { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, 0.15)
      .to(titleRef.current,   { opacity: 1, y: 0, duration: 0.5 }, '-=0.2')
      .to(taglineRef.current, { opacity: 1, y: 0, duration: 0.4 }, '-=0.2')
      .to(pillsRef.current,   { opacity: 1, y: 0, duration: 0.4 }, '-=0.1')
      .to(btnRef.current,     { opacity: 1, y: 0, duration: 0.4 }, '-=0.1')

    // Lantern float loops (start after entrance)
    gsap.to(lanternL.current, { y: -10, duration: 2.8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.8 })
    gsap.to(lanternR.current, { y: -10, duration: 3.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.2 })

    return () => { tl.kill() }
  }, [])

  const handleStart = () => {
    if (loading || clicked) return
    setClicked(true)
    // Fire API call immediately — don't wait for animation to finish
    onStart(numPlayers)
    const tl = gsap.timeline()
    tl.to(btnRef.current, { scaleX: 22, scaleY: 28, duration: 0.45, ease: 'power2.in' })
    tl.to(containerRef.current, { opacity: 0, duration: 0.35, ease: 'power1.in' }, '-=0.15')
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: `linear-gradient(180deg, #000008 0%, #05000f 50%, #0a0520 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* Fog gradient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 100% 50% at 50% 100%, rgba(232,168,56,0.06) 0%, transparent 70%)',
        animation: 'fog-drift 18s ease-in-out infinite',
      }} />

      {/* Stars */}
      {Array.from({ length: 70 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width:  (Math.random() * 2 + 0.8) + 'px',
          height: (Math.random() * 2 + 0.8) + 'px',
          top:  (Math.random() * 75) + '%',
          left: (Math.random() * 100) + '%',
          borderRadius: '50%',
          background: '#fff',
          opacity: Math.random() * 0.5 + 0.15,
          animation: `float ${2.5 + Math.random() * 3}s ease-in-out infinite`,
          animationDelay: (Math.random() * 4) + 's',
        }} />
      ))}

      {/* Left lantern */}
      <div ref={lanternL} style={{
        position: 'absolute', left: '5%', top: '22%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <LanternSVG />
        <LanternGlow />
      </div>

      {/* Right lantern */}
      <div ref={lanternR} style={{
        position: 'absolute', right: '5%', top: '22%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <LanternSVG />
        <LanternGlow />
      </div>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '2rem', padding: '0 1rem',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1
            ref={titleRef}
            style={{
              fontFamily: '"Cinzel Decorative", serif',
              fontSize: 'clamp(3rem, 10vw, 6rem)',
              fontWeight: 900,
              color: AMBER,
              margin: 0,
              textShadow: `0 0 40px ${AMBER}99, 0 0 80px ${AMBER}44`,
              letterSpacing: '0.05em',
              animation: 'pulse-glow 2.5s ease-in-out infinite',
            }}
          >
            MAFIA
          </h1>
          <p
            ref={taglineRef}
            style={{
              fontFamily: 'Lora, serif',
              fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
              color: 'rgba(255,255,255,0.55)',
              marginTop: '0.75rem',
              fontStyle: 'italic',
              letterSpacing: '0.02em',
            }}
          >
            One village. One wolf. Trust no one.
          </p>
        </div>

        {/* Player count */}
        <div ref={pillsRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
          }}>
            Number of players
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => setNumPlayers(n)}
                style={{
                  width: '3.2rem', height: '3.2rem',
                  borderRadius: '50%',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: numPlayers === n ? 'none' : `1px solid rgba(255,255,255,0.12)`,
                  background: numPlayers === n ? AMBER : CARD_BG,
                  color: numPlayers === n ? DARK_BG : 'rgba(255,255,255,0.6)',
                  transform: numPlayers === n ? 'scale(1.12)' : 'scale(1)',
                  boxShadow: numPlayers === n ? `0 0 16px ${AMBER}88` : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          ref={btnRef}
          onClick={handleStart}
          disabled={loading}
          style={{
            padding: '1rem 3.5rem',
            borderRadius: '999px',
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
            fontWeight: 700,
            color: DARK_BG,
            background: AMBER,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            boxShadow: `0 0 24px ${AMBER}88, 0 0 48px ${AMBER}33`,
            animation: 'pulse-glow 2s ease-in-out infinite',
            minWidth: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {loading ? 'Gathering villagers...' : 'BEGIN THE NIGHT'}
        </button>

        {/* Flavour */}
        <p style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          Round Table · Social Deduction · Survive
        </p>
      </div>

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '8rem',
        background: `linear-gradient(transparent, ${DARK_BG})`,
        pointerEvents: 'none',
      }} />

      {/* Atmospheric loading overlay — shows while API is processing */}
      {(clicked || loading) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'linear-gradient(180deg, #000008 0%, #05000f 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1.5rem',
          animation: 'fadeInUp 0.6s ease forwards',
        }}>
          {/* Ambient pulse */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,168,56,0.15) 0%, transparent 70%)',
            animation: 'pulse-glow 1.8s ease-in-out infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '40px', height: '40px',
              border: '2px solid rgba(232,168,56,0.5)',
              borderTopColor: '#e8a838',
              borderRadius: '50%',
              animation: 'spin 1.2s linear infinite',
            }} />
          </div>
          <p style={{
            fontFamily: 'Lora, serif', fontSize: '1rem',
            color: 'rgba(255,255,255,0.45)', fontStyle: 'italic',
            letterSpacing: '0.04em',
          }}>
            The village gathers in the shadows...
          </p>
          <p style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem',
            color: 'rgba(255,255,255,0.18)', letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}>
            Assigning roles · Setting the stage
          </p>
        </div>
      )}
    </div>
  )
}

function LanternSVG() {
  return (
    <svg width="36" height="58" viewBox="0 0 40 64" fill="none"
      style={{ filter: 'drop-shadow(0 0 8px rgba(232,168,56,0.7))' }}>
      <rect x="14" y="0" width="12" height="7" rx="2" fill={`rgba(232,168,56,0.8)`}/>
      <rect x="8" y="7" width="24" height="34" rx="4" fill="#0f0f1a" stroke={`rgba(232,168,56,0.7)`} strokeWidth="1.2"/>
      <rect x="14" y="12" width="12" height="22" rx="2" fill="rgba(232,168,56,0.15)"/>
      <ellipse cx="20" cy="18" rx="6" ry="8" fill="rgba(232,168,56,0.45)" className="lantern-flame"/>
      <rect x="12" y="41" width="16" height="4" rx="2" fill={`rgba(232,168,56,0.65)`}/>
      <line x1="20" y1="45" x2="20" y2="60" stroke={`rgba(232,168,56,0.3)`} strokeWidth="1.2"/>
    </svg>
  )
}

function LanternGlow() {
  return (
    <div style={{
      width: '60px', height: '60px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(232,168,56,0.15) 0%, transparent 70%)',
      marginTop: '-20px',
      pointerEvents: 'none',
    }} />
  )
}
