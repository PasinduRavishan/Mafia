/**
 * GameOverScreen — Victory / defeat reveal.
 * All elements start opacity:0 in JSX. GSAP set → to (no flash).
 */
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { GameStateResponse } from '../../types/game'

interface Props {
  gameState: GameStateResponse
  onPlayAgain: () => void
}

export default function GameOverScreen({ gameState, onPlayAgain }: Props) {
  const winner    = gameState.winner
  const isVillage = winner === 'village'

  const wrapRef  = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  const accentColor = isVillage ? '#27ae60' : '#c0392b'

  useEffect(() => {
    // Set all invisible first — no flash possible
    gsap.set([titleRef.current, tableRef.current, btnRef.current], { opacity: 0, y: 30 })

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
    tl.to(titleRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.5)' }, 0.3)
      .to(tableRef.current, { opacity: 1, y: 0, duration: 0.7 }, 0.8)
      .to(btnRef.current,   { opacity: 1, y: 0, duration: 0.5 }, 1.2)
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden',
        background: isVillage
          ? 'radial-gradient(ellipse at center, rgba(39,174,96,0.18) 0%, #0a0a0e 65%)'
          : 'radial-gradient(ellipse at center, rgba(192,57,43,0.22) 0%, #0a0a0e 65%)',
      }}
    >
      {/* Particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width:  Math.random() * 3 + 1 + 'px',
            height: Math.random() * 3 + 1 + 'px',
            top:  Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            borderRadius: '50%',
            opacity: Math.random() * 0.5 + 0.1,
            background: isVillage ? '#27ae60' : '#c0392b',
            animation: `float ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: Math.random() * 3 + 's',
          }} />
        ))}
      </div>

      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '1.8rem', padding: '0 1.5rem', maxWidth: '480px', width: '100%',
      }}>

        {/* Winner announcement */}
        <div ref={titleRef} style={{ textAlign: 'center', opacity: 0 }}>
          <div style={{ fontSize: '5rem', lineHeight: 1, marginBottom: '12px' }}>
            {isVillage ? '🏆' : '🐺'}
          </div>
          <h1 style={{
            fontFamily: '"Cinzel Decorative", serif',
            fontSize: 'clamp(2rem, 8vw, 3.5rem)',
            fontWeight: 900, margin: '0 0 12px',
            color: accentColor,
            textShadow: `0 0 40px ${accentColor}88, 0 0 80px ${accentColor}33`,
          }}>
            {isVillage ? 'VILLAGE WINS' : 'MAFIA WINS'}
          </h1>
          <p style={{
            fontFamily: 'Lora, serif', fontSize: '1.05rem',
            color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', margin: '0 0 10px',
            lineHeight: '1.6',
          }}>
            {isVillage
              ? 'The wolf has been unmasked. The village rests easy... for now.'
              : 'The Mafia rules the night. All hope is lost.'}
          </p>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.35)',
          }}>
            You played as{' '}
            <span style={{ color: accentColor, fontWeight: 600, textTransform: 'capitalize' }}>
              {gameState.your_role}
            </span>
            {' '}· Round {gameState.round_number}
          </p>
        </div>

        {/* Final standings table */}
        <div ref={tableRef} style={{
          opacity: 0,
          width: '100%',
          background: 'rgba(12,12,26,0.9)', backdropFilter: 'blur(16px)',
          border: `1px solid ${accentColor}22`,
          borderRadius: '20px', overflow: 'hidden',
          boxShadow: `0 0 40px ${accentColor}0a`,
        }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '0.9rem' }}>📜</span>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '0.68rem',
              color: `${accentColor}cc`, letterSpacing: '0.15em',
              textTransform: 'uppercase', margin: 0,
            }}>
              Final Standings
            </p>
          </div>
          <div>
            {gameState.alive_players.map(pid => (
              <PlayerRow key={pid} pid={pid} status="survived" isHuman={pid === 'human'} color={accentColor} />
            ))}
            {gameState.dead_players.map(pid => (
              <PlayerRow key={pid} pid={pid} status="eliminated" isHuman={pid === 'human'} color={accentColor} />
            ))}
          </div>
        </div>

        {/* Play again */}
        <button
          ref={btnRef}
          onClick={onPlayAgain}
          style={{
            opacity: 0,
            padding: '14px 52px', borderRadius: '999px', border: 'none',
            fontFamily: '"Cinzel Decorative", serif', fontWeight: 700,
            fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
            color: '#080812', background: accentColor, cursor: 'pointer',
            boxShadow: `0 0 30px ${accentColor}88, 0 8px 24px rgba(0,0,0,0.5)`,
            animation: 'pulse-glow 2.2s ease-in-out infinite',
            letterSpacing: '0.04em',
          }}
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  )
}

function PlayerRow({
  pid, status, isHuman, color,
}: {
  pid: string; status: 'survived' | 'eliminated'; isHuman: boolean; color: string
}) {
  const alive = status === 'survived'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      opacity: alive ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: alive ? '#27ae60' : '#4a4a5a',
          boxShadow: alive ? '0 0 6px #27ae6088' : 'none',
        }} />
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: '0.88rem',
          color: isHuman ? color : 'rgba(255,255,255,0.8)',
          fontWeight: isHuman ? 600 : 400,
        }}>
          {isHuman ? 'You' : pid}
        </span>
        {isHuman && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6rem',
            color: `${color}99`, letterSpacing: '0.1em',
          }}>
            (you)
          </span>
        )}
      </div>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem',
        padding: '3px 10px', borderRadius: '8px', letterSpacing: '0.08em',
        background: alive ? 'rgba(39,174,96,0.15)' : 'rgba(74,74,90,0.2)',
        color: alive ? '#27ae60' : '#4a4a5a',
      }}>
        {alive ? 'SURVIVED' : 'ELIMINATED'}
      </span>
    </div>
  )
}
