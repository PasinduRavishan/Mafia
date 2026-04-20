import { useState, useRef, useCallback } from 'react'
import { api } from '../api/client'
import type { GameStateResponse } from '../types/game'

export type Screen = 'landing' | 'role-reveal' | 'game' | 'game-over'

export function useGame() {
  const [screen, setScreen]       = useState<Screen>('landing')
  const [gameState, setGameState] = useState<GameStateResponse | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Poll until we get a prompt or game ends
  const startPolling = useCallback((gameId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const state = await api.getState(gameId)
        setGameState(state)
        if (state.prompt || state.game_over) {
          stopPolling()
        }
      } catch (e) {
        console.error('Poll error:', e)
      }
    }, 1500)
  }, [stopPolling])

  const startGame = useCallback(async (numPlayers: number) => {
    setLoading(true)
    setError(null)
    try {
      const state = await api.startGame({ num_players: numPlayers })
      setGameState(state)
      setScreen('role-reveal')
      // If game already has a prompt (NPC turns done), stop — else poll
      if (!state.prompt && !state.game_over) {
        startPolling(state.game_id)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start game')
    } finally {
      setLoading(false)
    }
  }, [startPolling])

  const proceedToGame = useCallback(() => {
    setScreen('game')
  }, [])

  const submitAction = useCallback(async (type: string, value: string) => {
    if (!gameState) return
    setLoading(true)
    setError(null)
    try {
      const state = await api.submitAction(gameState.game_id, { type, value })
      setGameState(state)
      if (state.game_over) {
        stopPolling()
        // Don't transition to game-over here — let GameScreen
        // finish its animations and call goToGameOver when ready
      } else if (!state.prompt) {
        // NPC turns are running — poll until our next prompt
        startPolling(state.game_id)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }, [gameState, startPolling, stopPolling])

  const goToGameOver = useCallback(() => {
    stopPolling()
    setScreen('game-over')
  }, [stopPolling])

  const resetGame = useCallback(() => {
    stopPolling()
    setGameState(null)
    setError(null)
    setScreen('landing')
  }, [stopPolling])

  return {
    screen,
    gameState,
    loading,
    error,
    startGame,
    proceedToGame,
    submitAction,
    goToGameOver,
    resetGame,
  }
}
