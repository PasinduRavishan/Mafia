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
