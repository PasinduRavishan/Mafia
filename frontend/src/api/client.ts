import type { GameStateResponse, StartGameRequest, ActionRequest } from '../types/game'

const BASE = 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  startGame: (req: StartGameRequest) =>
    request<GameStateResponse>('/game/start', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  getState: (gameId: string) =>
    request<GameStateResponse>(`/game/${gameId}/state`),

  submitAction: (gameId: string, req: ActionRequest) =>
    request<GameStateResponse>(`/game/${gameId}/action`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}
