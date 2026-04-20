import { useMemo, forwardRef, useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { GameStateResponse } from '../../types/game'

interface Props {
  gameState: GameStateResponse
  selectedPlayer: string | null
  selectablePlayers: string[]
  onSelectPlayer: (id: string) => void
  speakingPlayer?: string | null
  speechBubbles?: Record<string, string>   // playerId → message above head
  cardRefs?: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}

// 8 distinct avatar designs — each player index gets one
const AVATAR_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#9b59b6',
  '#f39c12','#1abc9c','#e91e63','#ff5722',
]

export default function RoundTable({
  gameState, selectedPlayer, selectablePlayers,
  onSelectPlayer, speakingPlayer, speechBubbles = {}, cardRefs,
}: Props) {
  const allPlayers = useMemo(() => {
    return [...new Set([...gameState.alive_players, ...gameState.dead_players])]
  }, [gameState])

  const total = allPlayers.length
  const tableSize = 'min(72vw, 72vh)'

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative',
        width: tableSize, height: tableSize,
        filter: 'drop-shadow(0 0 60px rgba(232,168,56,0.1))',
      }}>
        {/* Outer glow ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px solid rgba(232,168,56,0.12)',
          boxShadow: '0 0 80px rgba(232,168,56,0.06) inset',
        }} />

        {/* Table surface */}
        <div style={{
          position: 'absolute', inset: '10%', borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #101520 0%, #070b12 100%)',
          border: '1px solid rgba(232,168,56,0.08)',
        }}>
          {/* Narrator figure in center of table */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <NarratorCenter />
          </div>

          {/* Small candle near edge — decorative */}
          <div style={{
            position: 'absolute', bottom: '18%', right: '22%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            opacity: 0.55,
          }}>
            <div style={{
              width: '4px', height: '7px', borderRadius: '50% 50% 30% 30%',
              background: 'radial-gradient(#fff 10%, #e8a838 60%, transparent 100%)',
              boxShadow: '0 0 7px 3px #e8a83866',
              animation: 'lanternFlicker 3s ease-in-out infinite',
            }} />
            <div style={{
              width: '7px', height: '20px',
              background: 'linear-gradient(180deg, rgba(255,255,240,0.8) 0%, rgba(240,230,210,0.4) 100%)',
              borderRadius: '2px',
            }} />
            <div style={{ width: '11px', height: '3px', borderRadius: '50%', background: 'rgba(232,168,56,0.2)' }} />
          </div>
        </div>

        {/* Players around the table */}
        {allPlayers.map((pid, i) => {
          const angle = (i / total) * 360 - 90
          const rad   = angle * (Math.PI / 180)
          const r     = 46  // % radius from center
          const cx    = 50 + r * Math.cos(rad)
          const cy    = 50 + r * Math.sin(rad)
          const isAlive     = gameState.alive_players.includes(pid)
          const isSelectable = selectablePlayers.includes(pid)
          const isSelected   = selectedPlayer === pid
          const isSpeaking   = speakingPlayer === pid
          const bubble       = speechBubbles[pid]
          const avatarColor  = AVATAR_COLORS[i % AVATAR_COLORS.length]

          return (
            <PlayerSeat
              key={pid}
              pid={pid}
              avatarIndex={i}
              avatarColor={avatarColor}
              cx={cx}
              cy={cy}
              isAlive={isAlive}
              isSelectable={isSelectable}
              isSelected={isSelected}
              isSpeaking={isSpeaking}
              isHuman={pid === 'human'}
              speechBubble={bubble}
              onSelect={() => isSelectable && onSelectPlayer(pid)}
              ref={el => { if (cardRefs) cardRefs.current[pid] = el }}
            />
          )
        })}

        {/* Narrator speech bubble prop — shown above center figure */}
        {/* (narratorBubble from GameScreen passed via speechBubbles['__narrator__']) */}
      </div>
    </div>
  )
}

// ── PlayerSeat ───────────────────────────────────────────────────────────────

interface SeatProps {
  pid: string; avatarIndex: number; avatarColor: string
  cx: number; cy: number
  isAlive: boolean; isSelectable: boolean; isSelected: boolean
  isSpeaking: boolean; isHuman: boolean
  speechBubble?: string
  onSelect: () => void
}

const PlayerSeat = forwardRef<HTMLDivElement, SeatProps>(function PlayerSeat(
  { pid, avatarIndex, avatarColor, cx, cy, isAlive, isSelectable, isSelected, isSpeaking, isHuman, speechBubble, onSelect },
  ref,
) {
  const cardW = 'clamp(54px, 8vw, 78px)'

  const cardRef = useRef<HTMLDivElement>(null)
  const wasAlive = useRef(isAlive)

  useEffect(() => {
    if (wasAlive.current && !isAlive && cardRef.current) {
      // Death shake animation
      gsap.timeline()
        .to(cardRef.current, { x: -8, duration: 0.06, ease: 'power2.out' })
        .to(cardRef.current, { x: 8,  duration: 0.06 })
        .to(cardRef.current, { x: -6, duration: 0.05 })
        .to(cardRef.current, { x: 6,  duration: 0.05 })
        .to(cardRef.current, { x: -4, duration: 0.04 })
        .to(cardRef.current, { x: 0,  duration: 0.04 })
        .to(cardRef.current, {
          scale: 0.88, opacity: 0.3, filter: 'grayscale(100%) brightness(0.4)',
          duration: 0.7, ease: 'power3.in',
        })
        .to(cardRef.current, {
          scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.5)',
        })
    }
    wasAlive.current = isAlive
  }, [isAlive])

  const borderColor = isSelected
    ? '#e8a838'
    : isSpeaking
    ? '#e8a838'
    : isHuman
    ? 'rgba(232,168,56,0.5)'
    : 'rgba(255,255,255,0.07)'

  const shadowColor = isSelected
    ? `0 0 20px 6px rgba(232,168,56,0.7)`
    : isSpeaking
    ? `0 0 16px 4px rgba(232,168,56,0.5)`
    : 'none'

  return (
    <div
      ref={ref}
      onClick={onSelect}
      style={{
        position: 'absolute',
        left: `${cx}%`, top: `${cy}%`,
        transform: 'translate(-50%, -50%)',
        width: cardW,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        cursor: isSelectable ? 'pointer' : 'default',
        opacity: isAlive ? 1 : 0.35,
        filter: isAlive ? 'none' : 'grayscale(80%)',
        zIndex: isSelected || isSpeaking ? 10 : 5,
        transition: 'transform 0.2s ease',
      }}
    >
      {/* Speech bubble above head */}
      {speechBubble && (
        <div style={{
          position: 'absolute',
          bottom: '100%', left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          width: 'clamp(130px, 20vw, 200px)',
          background: 'rgba(20,20,35,0.96)',
          border: '1px solid rgba(232,168,56,0.3)',
          borderRadius: '12px',
          padding: '8px 12px',
          fontFamily: 'Lora, serif',
          fontSize: 'clamp(0.6rem, 1.2vw, 0.75rem)',
          color: 'rgba(255,255,255,0.85)',
          fontStyle: 'italic',
          lineHeight: '1.4',
          zIndex: 20,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.4s ease forwards',
          // Triangle pointer
        }}>
          {speechBubble}
          <div style={{
            position: 'absolute', bottom: '-8px', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(20,20,35,0.96)',
          }} />
        </div>
      )}

      {/* Avatar card */}
      <div ref={cardRef} style={{
        width: '100%',
        aspectRatio: '3/4',
        borderRadius: '12px',
        background: isHuman
          ? 'linear-gradient(160deg, #1e2a3e, #0f1828)'
          : 'linear-gradient(160deg, #141420, #0a0a14)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: shadowColor,
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.2s ease',
        transform: isSelected ? 'scale(1.1) translateY(-4px)' : isSelectable ? undefined : 'none',
      }}
      onMouseEnter={e => {
        if (isSelectable && !isSelected) {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.06) translateY(-3px)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.transform = ''
        }
      }}
      >
        {/* Avatar illustration */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: '4px',
        }}>
          <AvatarSVG index={avatarIndex} color={isHuman ? '#e8a838' : avatarColor} isAlive={isAlive} />
        </div>

        {/* Human badge */}
        {isHuman && (
          <div style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#e8a838',
            boxShadow: '0 0 6px #e8a83888',
          }} />
        )}

        {/* Dead overlay */}
        {!isAlive && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
          }}>
            💀
          </div>
        )}

        {/* Speaking pulse ring */}
        {isSpeaking && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '11px',
            border: '2px solid #e8a838',
            animation: 'pulse-glow 1s ease-in-out infinite',
          }} />
        )}

        {/* Selection ring */}
        {isSelected && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '11px',
            border: '2px solid #e8a838',
            animation: 'pulse-glow 0.8s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Name */}
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 'clamp(7px, 1.1vw, 11px)',
        color: isHuman ? '#e8a838' : isAlive ? 'rgba(255,255,255,0.8)' : '#555',
        fontWeight: isHuman ? 600 : 400,
        textAlign: 'center',
        maxWidth: '90%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isHuman ? 'You' : pid}
      </span>

      {/* Alive indicator */}
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: isAlive ? '#27ae60' : '#333',
        boxShadow: isAlive ? '0 0 6px #27ae6088' : 'none',
        transition: 'background 0.5s ease',
      }} />
    </div>
  )
})

// ── Distinct avatar SVGs ─────────────────────────────────────────────────────

const AVATAR_SHAPES = [
  // 0 Hooded rogue
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <ellipse cx="20" cy="14" rx="9" ry="10" fill={c} opacity="0.9"/>
      <path d="M8 52 Q8 30 20 28 Q32 30 32 52Z" fill={c} opacity="0.8"/>
      <path d="M11 10 Q11 2 20 2 Q29 2 29 10 L29 16 Q24 14 20 14 Q16 14 11 16Z" fill={`${c}99`}/>
    </svg>
  ),
  // 1 Knight
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <rect x="12" y="4" width="16" height="18" rx="8" fill={c} opacity="0.9"/>
      <rect x="10" y="2" width="20" height="12" rx="4" fill={`${c}66`}/>
      <path d="M7 52 Q7 30 20 28 Q33 30 33 52Z" fill={c} opacity="0.8"/>
      <rect x="14" y="10" width="12" height="6" rx="1" fill="rgba(0,0,0,0.3)"/>
    </svg>
  ),
  // 2 Mage
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <circle cx="20" cy="14" r="9" fill={c} opacity="0.9"/>
      <path d="M8 52 Q8 30 20 28 Q32 30 32 52Z" fill={c} opacity="0.8"/>
      <polygon points="20,0 23,8 16,8" fill={`${c}cc`}/>
      <circle cx="20" cy="14" r="4" fill="rgba(0,0,0,0.2)"/>
    </svg>
  ),
  // 3 Merchant
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <ellipse cx="20" cy="14" rx="9" ry="10" fill={c} opacity="0.9"/>
      <path d="M9 52 Q9 30 20 28 Q31 30 31 52Z" fill={c} opacity="0.8"/>
      <ellipse cx="20" cy="5" rx="11" ry="4" fill={`${c}88`}/>
    </svg>
  ),
  // 4 Guard
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <rect x="12" y="5" width="16" height="18" rx="4" fill={c} opacity="0.9"/>
      <path d="M8 52 Q8 30 20 28 Q32 30 32 52Z" fill={c} opacity="0.8"/>
      <path d="M15 5 Q20 0 25 5" fill="none" stroke={`${c}aa`} strokeWidth="2"/>
    </svg>
  ),
  // 5 Healer
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <circle cx="20" cy="14" r="9" fill={c} opacity="0.9"/>
      <path d="M9 52 Q9 30 20 28 Q31 30 31 52Z" fill={c} opacity="0.8"/>
      <path d="M17 11 L17 17 M14 14 L23 14" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  // 6 Elder
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <ellipse cx="20" cy="15" rx="8" ry="9" fill={c} opacity="0.9"/>
      <path d="M10 52 Q10 32 20 30 Q30 32 30 52Z" fill={c} opacity="0.8"/>
      <path d="M12 12 Q20 8 28 12" fill="none" stroke={`${c}88`} strokeWidth="1.5"/>
      <line x1="20" y1="24" x2="20" y2="52" stroke={`${c}44`} strokeWidth="2"/>
    </svg>
  ),
  // 7 Rogue
  (c: string) => (
    <svg viewBox="0 0 40 52" width="80%">
      <circle cx="20" cy="13" r="9" fill={c} opacity="0.9"/>
      <path d="M7 52 Q7 30 20 28 Q33 30 33 52Z" fill={c} opacity="0.8"/>
      <path d="M11 10 Q14 4 20 3 Q26 4 29 10" fill={`${c}77`}/>
      <ellipse cx="20" cy="13" rx="5" ry="4" fill="rgba(0,0,0,0.25)"/>
    </svg>
  ),
]

function AvatarSVG({ index, color, isAlive }: { index: number; color: string; isAlive: boolean }) {
  const shape = AVATAR_SHAPES[index % AVATAR_SHAPES.length]
  return (
    <div style={{ opacity: isAlive ? 1 : 0.4, width: '100%', display: 'flex', justifyContent: 'center' }}>
      {shape(color)}
    </div>
  )
}

// ── Narrator in center of table ──────────────────────────────────────────────

function NarratorCenter() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      animation: 'float 4s ease-in-out infinite',
    }}>
      <svg viewBox="0 0 50 68" width="clamp(32px, 4.5vw, 46px)"
        style={{ filter: 'drop-shadow(0 0 6px rgba(232,168,56,0.5))' }}>
        {/* Hood */}
        <path d="M9 19 Q9 2 25 2 Q41 2 41 19 L41 25 Q33 23 25 23 Q17 23 9 25Z"
          fill="#10102a" stroke="rgba(232,168,56,0.65)" strokeWidth="0.8"/>
        {/* Robe */}
        <path d="M9 25 Q6 50 5 68 L45 68 Q44 50 41 25 Q33 23 25 23 Q17 23 9 25Z"
          fill="#080818" stroke="rgba(232,168,56,0.4)" strokeWidth="0.8"/>
        {/* Face void */}
        <ellipse cx="25" cy="16" rx="9" ry="9" fill="#06060e" opacity="0.95"/>
        {/* Glowing amber eyes */}
        <circle cx="21" cy="15" r="1.6" fill="#e8a838" opacity="0.85"
          style={{ animation: 'lanternFlicker 3s ease-in-out infinite' }}/>
        <circle cx="29" cy="15" r="1.6" fill="#e8a838" opacity="0.85"
          style={{ animation: 'lanternFlicker 3s ease-in-out infinite', animationDelay: '0.6s' }}/>
        {/* Staff */}
        <line x1="41" y1="24" x2="48" y2="46" stroke="rgba(232,168,56,0.45)" strokeWidth="1.2"/>
        {/* Lantern */}
        <rect x="44" y="46" width="7" height="12" rx="2" fill="#10102a" stroke="rgba(232,168,56,0.6)" strokeWidth="0.8"/>
        <rect x="46" y="49" width="3" height="6" rx="1" fill="rgba(232,168,56,0.4)"
          style={{ animation: 'lanternFlicker 2.5s ease-in-out infinite' }}/>
      </svg>
      <span style={{
        fontFamily: '"Cinzel Decorative", serif',
        fontSize: 'clamp(5px, 0.8vw, 9px)',
        color: 'rgba(232,168,56,0.55)', letterSpacing: '0.18em',
      }}>
        NARRATOR
      </span>
    </div>
  )
}
