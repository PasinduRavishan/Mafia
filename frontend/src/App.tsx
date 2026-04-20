import './index.css'
import { useGame } from './hooks/useGame'
import LandingScreen   from './components/screens/LandingScreen'
import RoleRevealScreen from './components/screens/RoleRevealScreen'
import GameScreen      from './components/screens/GameScreen'
import GameOverScreen  from './components/screens/GameOverScreen'

export default function App() {
  const { screen, gameState, loading, error, startGame, proceedToGame, submitAction, goToGameOver, resetGame } = useGame()

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0d0d0d' }}>

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-xl px-5 py-3 text-mafia text-sm font-inter border border-mafia/30">
          ⚠️ {error}
        </div>
      )}

      {/* Global loading overlay — lives outside LandingScreen so GSAP fading doesn't hide it */}
      {loading && screen === 'landing' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(180deg, #000008 0%, #05000f 60%, #0a0520 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '2rem',
          animation: 'fadeInUp 0.5s ease forwards',
        }}>
          {/* Ambient ring */}
          <div style={{
            position: 'relative', width: '90px', height: '90px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,168,56,0.18) 0%, transparent 70%)',
              animation: 'pulse-glow 2s ease-in-out infinite',
            }} />
            <div style={{
              width: '44px', height: '44px',
              border: '2px solid rgba(232,168,56,0.25)',
              borderTopColor: '#e8a838',
              borderRadius: '50%',
              animation: 'spin 1.1s linear infinite',
            }} />
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <p style={{
              fontFamily: '"Cinzel Decorative", serif', fontSize: '1rem',
              color: 'rgba(232,168,56,0.85)', letterSpacing: '0.14em',
              textTransform: 'uppercase', margin: 0,
              animation: 'pulse-glow 2.5s ease-in-out infinite',
            }}>
              Loading the Game
            </p>
            <p style={{
              fontFamily: 'Lora, serif', fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.38)', fontStyle: 'italic',
              margin: 0,
            }}>
              The village gathers in the shadows...
            </p>
          </div>

          {/* Decorative lantern dots */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: 'rgba(232,168,56,0.6)',
                animation: `pulse-glow 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }} />
            ))}
          </div>
        </div>
      )}

      {screen === 'landing' && (
        <LandingScreen onStart={startGame} loading={loading} />
      )}

      {screen === 'role-reveal' && gameState && (
        <RoleRevealScreen gameState={gameState} onReady={proceedToGame} />
      )}

      {screen === 'game' && gameState && (
        <GameScreen
          gameState={gameState}
          onSubmit={submitAction}
          onGameOver={goToGameOver}
          loading={loading}
        />
      )}

      {screen === 'game-over' && gameState && (
        <GameOverScreen gameState={gameState} onPlayAgain={resetGame} />
      )}
    </div>
  )
}
