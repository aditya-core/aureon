export interface SavedTab { url: string; title: string; groupName?: string; groupKey?: string; groupColor?: chrome.tabGroups.ColorEnum; pinned?: boolean }
export interface SavedSession { id: string; name: string; createdAt: number; updatedAt: number; tabs: SavedTab[] }
export const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']
export const SUGGESTIONS = ['Work', 'Study', 'Research', 'Entertainment', 'Shopping', 'Personal']

/** Only HTTP(S) destinations without credentials are saved or restored. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null } catch { return null }
}
/** Ignore fragments but retain the exact query string. */
export function duplicateKey(value: unknown): string | null {
  const safe = safeUrl(value)
  if (!safe) return null
  const u = new URL(safe); u.hash = ''; return u.href
}
export function duplicates(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[][] {
  const groups = new Map<string, chrome.tabs.Tab[]>()
  for (const tab of tabs) {
    const key = duplicateKey(tab.url)
    if (!key || tab.id === undefined) continue
    const scoped = `${tab.incognito ? 'private' : 'normal'}:${key}`
    groups.set(scoped, [...(groups.get(scoped) ?? []), tab])
  }
  return [...groups.values()].filter(group => group.length > 1)
}
export function hostname(url?: string): string {
  try { return new URL(url ?? '').hostname || 'Browser page' } catch { return 'Browser page' }
}
export function isInactive(tab: chrome.tabs.Tab, now = Date.now()): boolean {
  return !tab.active && typeof tab.lastAccessed === 'number' && now - tab.lastAccessed >= 30 * 60_000
}
export function saveableTabs(tabs: chrome.tabs.Tab[], groups: chrome.tabGroups.TabGroup[]): { tabs: SavedTab[]; skipped: number } {
  const byId = new Map(groups.map(group => [group.id, group]))
  const result: SavedTab[] = []; let skipped = 0
  for (const tab of tabs) {
    const url = tab.incognito ? null : safeUrl(tab.url)
    if (!url) { skipped++; continue }
    const group = byId.get(tab.groupId)
    result.push({ url, title: (tab.title || hostname(url)).slice(0, 200), pinned: !!tab.pinned, ...(group ? { groupName: (group.title || 'Group').slice(0, 80), groupKey: String(group.id), groupColor: group.color } : {}) })
  }
  return { tabs: result, skipped }
}
export function normalizeSession(input: unknown): SavedSession | null {
  if (!input || typeof input !== 'object') return null
  const v = input as Record<string, unknown>
  if (typeof v.id !== 'string' || !v.id || v.id.length > 80 || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 80 || typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt) || typeof v.updatedAt !== 'number' || !Number.isFinite(v.updatedAt) || !Array.isArray(v.tabs) || v.tabs.length > 500) return null
  const tabs: SavedTab[] = []
  for (const raw of v.tabs) {
    if (!raw || typeof raw !== 'object') continue
    const t = raw as Record<string, unknown>
    const url = typeof t.url === 'string' && t.url.length <= 4096 ? t.url : ''
    if (!url) continue
    const groupColor = typeof t.groupColor === 'string' && GROUP_COLORS.includes(t.groupColor as chrome.tabGroups.ColorEnum) ? t.groupColor as chrome.tabGroups.ColorEnum : undefined
    tabs.push({ url, title: typeof t.title === 'string' ? t.title.slice(0, 200) : hostname(url), pinned: t.pinned === true, ...(typeof t.groupName === 'string' && t.groupName.trim() ? { groupName: t.groupName.slice(0, 80), ...(typeof t.groupKey === 'string' && t.groupKey.length <= 80 ? { groupKey: t.groupKey } : {}), groupColor } : {}) })
  }
  return { id: v.id, name: v.name.trim(), createdAt: v.createdAt, updatedAt: v.updatedAt, tabs }
}
