export type FocusMode = 'focus' | 'short' | 'long'
export interface FocusState {
  mode: FocusMode
  durations: Record<FocusMode, number>
  remainingMs: number
  endsAt: number | null
  completed: boolean
  sessions: number
}
export const DEFAULT_FOCUS: FocusState = { mode: 'focus', durations: { focus: 25, short: 5, long: 15 }, remainingMs: 25 * 60_000, endsAt: null, completed: false, sessions: 0 }
export function normalizeFocus(value: unknown): FocusState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_FOCUS, durations: { ...DEFAULT_FOCUS.durations } }
  const v = value as Record<string, unknown>
  const raw = v.durations && typeof v.durations === 'object' ? v.durations as Record<string, unknown> : {}
  const duration = (key: FocusMode) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? Math.max(1, Math.min(180, Math.round(raw[key] as number))) : DEFAULT_FOCUS.durations[key]
  const mode: FocusMode = v.mode === 'short' || v.mode === 'long' ? v.mode : 'focus'
  const durations = { focus: duration('focus'), short: duration('short'), long: duration('long') }
  return { mode, durations, remainingMs: typeof v.remainingMs === 'number' && Number.isFinite(v.remainingMs) ? Math.max(0, Math.min(180 * 60_000, v.remainingMs)) : durations[mode] * 60_000, endsAt: typeof v.endsAt === 'number' && Number.isFinite(v.endsAt) ? v.endsAt : null, completed: v.completed === true, sessions: typeof v.sessions === 'number' && Number.isSafeInteger(v.sessions) && v.sessions >= 0 ? v.sessions : 0 }
}
export function remainingFocus(state: FocusState, now: number): number { return state.endsAt === null ? state.remainingMs : Math.max(0, state.endsAt - now) }
export function reconcileFocus(state: FocusState, now: number): FocusState {
  if (state.endsAt === null || state.endsAt > now) return state
  return { ...state, endsAt: null, remainingMs: 0, completed: true, sessions: state.sessions + (state.mode === 'focus' ? 1 : 0) }
}
export function formatRemaining(ms: number): string { const seconds = Math.ceil(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
