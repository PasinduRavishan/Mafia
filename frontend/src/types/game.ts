// TypeScript types mirroring FastAPI response models exactly

export type Role = 'mafia' | 'detective' | 'medic' | 'villager'
export type Phase = 'setup' | 'night' | 'day' | 'vote' | 'ended'
export type Winner = 'village' | 'mafia' | null

export interface PromptPayload {
  type: 'night_action' | 'day_statement' | 'vote'
  message: string
  options: string[] | null
  npc_votes?: Record<string, string> | null       // vote prompt: {voter_id: target_id}
  npc_statements?: DayStatement[] | null           // day_statement prompt: NPC speeches already done
}

export interface DayStatement {
  player_id: string
  statement: string
}

export interface GameStateResponse {
  game_id: string
  round_number: number
  phase: Phase
  alive_players: string[]
  dead_players: string[]
  public_log: string[]
  day_statements: DayStatement[]
  prompt: PromptPayload | null
  game_over: boolean
  winner: Winner
  your_role: Role
  mafia_teammates: string[] | null
  investigation_ledger: Record<string, string> | null
  medic_self_heal_used: boolean | null
}

export interface StartGameRequest {
  num_players: number
}

export interface ActionRequest {
  type: string
  value: string
}

// UI-only types
export interface PlayerSeat {
  id: string
  name: string
  isAlive: boolean
  isHuman: boolean
  angle: number  // degrees around the table circle
}

export const ROLE_COLORS: Record<Role, string> = {
  mafia:     '#c0392b',
  detective: '#2980b9',
  medic:     '#27ae60',
  villager:  '#7f8c8d',
}

export const ROLE_LABELS: Record<Role, string> = {
  mafia:     'MAFIA',
  detective: 'DETECTIVE',
  medic:     'MEDIC',
  villager:  'VILLAGER',
}

export const ROLE_ICONS: Record<Role, string> = {
  mafia:     '🐺',
  detective: '🔍',
  medic:     '🛡️',
  villager:  '🏠',
}

export const ROLE_TAGLINES: Record<Role, string> = {
  mafia:     'Hunt in the shadows. Trust is your weapon.',
  detective: 'Truth hides in darkness. Find it before it\'s too late.',
  medic:     'Every life is precious. Protect them.',
  villager:  'You know nothing. Watch everyone. Trust no one.',
}
