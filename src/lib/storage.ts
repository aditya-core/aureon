import { DEFAULT_PREFERENCES } from './defaults'
import { STARTER_SHORTCUTS, validateShortcutUrl } from './shortcuts'
import type { DashboardSection, Note, Shortcut, Task, UserPreferences, WorkspaceWidget, WidgetSize } from './types'

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
  const visibleWidgets = Array.isArray(v.visibleWidgets) ? [...new Set(v.visibleWidgets.filter((item): item is UserPreferences['visibleWidgets'][number] => includes(widgets, item)))] : [...DEFAULT_PREFERENCES.visibleWidgets]
  if (v.layout === 'balanced' || v.layout === 'compact') {
    if (!visibleWidgets.includes('shortcuts')) visibleWidgets.push('shortcuts')
  }
  const sectionNames: DashboardSection[] = ['clock', 'search', 'shortcuts', 'widgets']
  const sectionOrder = Array.isArray(v.sectionOrder) ? v.sectionOrder.filter((item): item is DashboardSection => includes(sectionNames, item)) : []
  const rawSizes = isRecord(v.widgetSizes) ? v.widgetSizes : {}
  const size = (key: WorkspaceWidget): WidgetSize => includes(['normal', 'wide'] as const, rawSizes[key]) ? rawSizes[key] : 'normal'
  const defaultOrder = DEFAULT_PREFERENCES.shortcutOrder
  const order = Array.isArray(v.shortcutOrder) ? v.shortcutOrder.filter((item): item is string => typeof item === 'string' && defaultOrder.includes(item)) : []
  return {
    theme: includes(['midnight', 'dawn', 'aurora', 'custom'] as const, v.theme) ? v.theme : DEFAULT_PREFERENCES.theme,
    accentColor: color(v.accentColor, DEFAULT_PREFERENCES.accentColor),
    wallpaper: typeof v.wallpaper === 'string' ? v.wallpaper : null,
    background: includes(['theme', 'solid', 'mist', 'aurora', 'dunes', 'orbit', 'horizon', 'grove', 'upload'] as const, v.background) ? v.background : DEFAULT_PREFERENCES.background,
    backgroundColor: color(v.backgroundColor, DEFAULT_PREFERENCES.backgroundColor),
    customTextColor: color(v.customTextColor, DEFAULT_PREFERENCES.customTextColor),
    customSurfaceColor: color(v.customSurfaceColor, DEFAULT_PREFERENCES.customSurfaceColor),
    gradientStart: color(v.gradientStart, DEFAULT_PREFERENCES.gradientStart),
    gradientEnd: color(v.gradientEnd, DEFAULT_PREFERENCES.gradientEnd),
    gradientAngle: number(v.gradientAngle, DEFAULT_PREFERENCES.gradientAngle, 0, 360),
    borderIntensity: number(v.borderIntensity, DEFAULT_PREFERENCES.borderIntensity, 0, 100),
    shadowIntensity: number(v.shadowIntensity, DEFAULT_PREFERENCES.shadowIntensity, 0, 100),
    wallpaperX: number(v.wallpaperX, DEFAULT_PREFERENCES.wallpaperX, 0, 100),
    wallpaperY: number(v.wallpaperY, DEFAULT_PREFERENCES.wallpaperY, 0, 100),
    alignment: includes(['center', 'left'] as const, v.alignment) ? v.alignment : DEFAULT_PREFERENCES.alignment,
    sectionOrder: [...new Set([...sectionOrder, ...sectionNames])],
    widgetSizes: { notes: size('notes'), tasks: size('tasks'), focus: size('focus') },
    overlay: number(v.overlay, DEFAULT_PREFERENCES.overlay, 0, 80),
    brightness: number(v.brightness, DEFAULT_PREFERENCES.brightness, 40, 120),
    blur: number(v.blur, DEFAULT_PREFERENCES.blur, 0, 12),
    surface: includes(['soft', 'solid'] as const, v.surface) ? v.surface : DEFAULT_PREFERENCES.surface,
    clockFormat: includes(['12h', '24h'] as const, v.clockFormat) ? v.clockFormat : DEFAULT_PREFERENCES.clockFormat,
    showSeconds: typeof v.showSeconds === 'boolean' ? v.showSeconds : false,
    displayName: typeof v.displayName === 'string' ? v.displayName.slice(0, 50) : '',
    greetingEnabled: typeof v.greetingEnabled === 'boolean' ? v.greetingEnabled : DEFAULT_PREFERENCES.greetingEnabled,
    animationIntensity: v.animationIntensity === 'full' ? 'expressive' : includes(['off', 'subtle', 'standard', 'expressive'] as const, v.animationIntensity) ? v.animationIntensity : DEFAULT_PREFERENCES.animationIntensity,
    reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    visibleWidgets,
    searchEngine: includes(['google', 'duckduckgo', 'bing'] as const, v.searchEngine) ? v.searchEngine : DEFAULT_PREFERENCES.searchEngine,
    layout: v.layout === 'compact' ? 'focus' : includes(['focus', 'workspace', 'immersive'] as const, v.layout) ? v.layout : DEFAULT_PREFERENCES.layout,
    spacing: includes(['compact', 'comfortable'] as const, v.spacing) ? v.spacing : v.layout === 'compact' ? 'compact' : DEFAULT_PREFERENCES.spacing,
    shortcutOrder: [...new Set([...order, ...defaultOrder])],
    widgetOrder: [...new Set([...(Array.isArray(v.widgetOrder) ? v.widgetOrder.filter((item): item is 'notes' | 'tasks' | 'focus' => includes(['notes', 'tasks', 'focus'] as const, item)) : []), ...DEFAULT_PREFERENCES.widgetOrder])],
  }
}
export async function getPreferences(): Promise<UserPreferences> { return normalizePreferences(await read('preferences')) }
export async function savePreferences(preferences: UserPreferences): Promise<void> { await write('preferences', normalizePreferences(preferences)) }
export async function resetPreferences(): Promise<void> { await write('preferences', DEFAULT_PREFERENCES) }
async function getList<T>(key: string): Promise<T[]> { const value = await read(key); return Array.isArray(value) ? value as T[] : [] }
export async function getShortcuts(): Promise<Shortcut[]> {
  const list = await getList<unknown>('shortcuts')
  return list.filter((item): item is Shortcut => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.url === 'string' && !!validateShortcutUrl(item.url) && typeof item.position === 'number').map(item => { const safe = { ...item, url: validateShortcutUrl(item.url)!, icon: typeof item.icon === 'string' ? item.icon.slice(0, 4) : null }; if (typeof safe.category !== 'string') delete safe.category; if (typeof safe.useFavicon !== 'boolean') delete safe.useFavicon; return safe })
}
// Preserve the Day 2 starter order; a stored empty list means the user deleted everything.
export async function getInitialShortcuts(order: string[]): Promise<Shortcut[]> {
  const value = await read('shortcuts')
  if (value !== undefined) return getShortcuts()
  return [...STARTER_SHORTCUTS].sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title))
}
export async function saveShortcuts(shortcuts: Shortcut[]): Promise<void> { await write('shortcuts', shortcuts) }
export async function getNotes(): Promise<Note[]> { const list = await getList<unknown>('notes'); return list.filter((item): item is Note => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string') }
export async function saveNotes(notes: Note[]): Promise<void> { await write('notes', notes) }
export async function getTasks(): Promise<Task[]> { const list = await getList<unknown>('tasks'); return list.filter((item): item is Task => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.completed === 'boolean' && typeof item.createdAt === 'string').map(item => { const safe = { ...item }; if (safe.priority !== 'low' && safe.priority !== 'medium' && safe.priority !== 'high') delete safe.priority; if (typeof safe.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(safe.dueDate)) delete safe.dueDate; return safe }) }
export async function saveTasks(tasks: Task[]): Promise<void> { await write('tasks', tasks) }

export async function getFocusState(): Promise<unknown> { return read('focusState') }
export async function saveFocusState(state: import('./focus').FocusState): Promise<void> { await write('focusState', state) }

// Profile snapshots are stored independently from the active preferences and productivity data.
export async function getStoredProfiles(): Promise<unknown> { return read('profiles') }
export async function saveStoredProfiles(value: unknown): Promise<void> { await write('profiles', value) }
