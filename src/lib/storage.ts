import { DEFAULT_PREFERENCES } from './defaults'
import type { Note, Shortcut, Task, UserPreferences } from './types'

// Chrome storage is the source of truth in the extension. localStorage is only a
// development-preview fallback; it is not shared with the installed extension.
async function read(key: string): Promise<unknown> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(key)
    return result[key]
  }
  const value = localStorage.getItem(`nova:${key}`)
  if (value === null) return undefined
  try { return JSON.parse(value) as unknown } catch { return undefined }
}

async function write(key: string, value: unknown): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [key]: value })
  } else {
    localStorage.setItem(`nova:${key}`, JSON.stringify(value))
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Stored values may be absent, stale, or malformed. Validate each field rather
// than spreading untrusted data over the defaults.
export function normalizePreferences(value: unknown): UserPreferences {
  const v = isRecord(value) ? value : {}
  const includes = <T extends string>(options: readonly T[], item: unknown): item is T =>
    typeof item === 'string' && options.some(option => option === item)
  const color = (item: unknown, fallback: string) => typeof item === 'string' && /^#[0-9a-f]{6}$/i.test(item) ? item : fallback
  const number = (item: unknown, fallback: number, min: number, max: number) => typeof item === 'number' && Number.isFinite(item) ? Math.max(min, Math.min(max, item)) : fallback
  const widgets = ['clock', 'shortcuts', 'notes', 'tasks', 'focus', 'bookmarks'] as const
  // Day 1 always displayed shortcuts, so add them when migrating old settings.
  const visibleWidgets = Array.isArray(v.visibleWidgets) ? v.visibleWidgets.filter((item): item is UserPreferences['visibleWidgets'][number] => includes(widgets, item)) : [...DEFAULT_PREFERENCES.visibleWidgets]
  if (v.layout === 'balanced' || v.layout === 'compact') {
    if (!visibleWidgets.includes('shortcuts')) visibleWidgets.push('shortcuts')
  }
  const defaultOrder = DEFAULT_PREFERENCES.shortcutOrder
  const order = Array.isArray(v.shortcutOrder) ? v.shortcutOrder.filter((item): item is string => typeof item === 'string' && defaultOrder.includes(item)) : []
  return {
    theme: includes(['midnight', 'dawn', 'aurora', 'custom'] as const, v.theme) ? v.theme : DEFAULT_PREFERENCES.theme,
    accentColor: color(v.accentColor, DEFAULT_PREFERENCES.accentColor),
    wallpaper: typeof v.wallpaper === 'string' ? v.wallpaper : null,
    background: includes(['theme', 'solid', 'mist', 'aurora', 'dunes', 'orbit', 'upload'] as const, v.background) ? v.background : DEFAULT_PREFERENCES.background,
    backgroundColor: color(v.backgroundColor, DEFAULT_PREFERENCES.backgroundColor),
    overlay: number(v.overlay, DEFAULT_PREFERENCES.overlay, 0, 80),
    brightness: number(v.brightness, DEFAULT_PREFERENCES.brightness, 40, 120),
    blur: number(v.blur, DEFAULT_PREFERENCES.blur, 0, 12),
    surface: includes(['soft', 'solid'] as const, v.surface) ? v.surface : DEFAULT_PREFERENCES.surface,
    clockFormat: includes(['12h', '24h'] as const, v.clockFormat) ? v.clockFormat : DEFAULT_PREFERENCES.clockFormat,
    greetingEnabled: typeof v.greetingEnabled === 'boolean' ? v.greetingEnabled : DEFAULT_PREFERENCES.greetingEnabled,
    animationIntensity: v.animationIntensity === 'full' ? 'expressive' : includes(['off', 'subtle', 'standard', 'expressive'] as const, v.animationIntensity) ? v.animationIntensity : DEFAULT_PREFERENCES.animationIntensity,
    reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    visibleWidgets,
    searchEngine: includes(['google', 'duckduckgo', 'bing'] as const, v.searchEngine) ? v.searchEngine : DEFAULT_PREFERENCES.searchEngine,
    layout: v.layout === 'compact' ? 'focus' : includes(['focus', 'workspace', 'immersive'] as const, v.layout) ? v.layout : DEFAULT_PREFERENCES.layout,
    spacing: includes(['compact', 'comfortable'] as const, v.spacing) ? v.spacing : v.layout === 'compact' ? 'compact' : DEFAULT_PREFERENCES.spacing,
    shortcutOrder: [...new Set([...order, ...defaultOrder])],
  }
}
export async function getPreferences(): Promise<UserPreferences> { return normalizePreferences(await read('preferences')) }
export async function savePreferences(preferences: UserPreferences): Promise<void> { await write('preferences', normalizePreferences(preferences)) }
export async function resetPreferences(): Promise<void> { await write('preferences', DEFAULT_PREFERENCES) }
async function getList<T>(key: string): Promise<T[]> { const value = await read(key); return Array.isArray(value) ? value as T[] : [] }
export async function getShortcuts(): Promise<Shortcut[]> { return getList<Shortcut>('shortcuts') }
export async function saveShortcuts(shortcuts: Shortcut[]): Promise<void> { await write('shortcuts', shortcuts) }
export async function getNotes(): Promise<Note[]> { return getList<Note>('notes') }
export async function saveNotes(notes: Note[]): Promise<void> { await write('notes', notes) }
export async function getTasks(): Promise<Task[]> { return getList<Task>('tasks') }
export async function saveTasks(tasks: Task[]): Promise<void> { await write('tasks', tasks) }
