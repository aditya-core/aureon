import { normalizeSession } from './model'
import type { SavedSession } from './model'
const KEY = 'nova:savedSessions'
let writes: Promise<void> = Promise.resolve()
export async function getSessions(): Promise<SavedSession[]> {
  await writes.catch(() => {})
  const stored: unknown = (await chrome.storage.local.get(KEY))[KEY]
  if (stored === undefined) return []
  if (!Array.isArray(stored) || stored.length > 50) throw new Error('Saved workspaces could not be read. Existing data was not changed.')
  const sessions = stored.map(normalizeSession)
  if (sessions.some(item => !item)) throw new Error('Saved workspaces contain invalid data. Existing data was not changed.')
  return sessions as SavedSession[]
}
export function updateSessions(change: (items: SavedSession[]) => SavedSession[]): Promise<void> {
  const operation = writes.catch(() => {}).then(async () => {
    const stored: unknown = (await chrome.storage.local.get(KEY))[KEY]
    if (stored !== undefined && (!Array.isArray(stored) || stored.length > 50)) throw new Error('Saved workspaces could not be read; no changes were made.')
    const raw: unknown[] = Array.isArray(stored) ? stored : []
    const normalized = raw.map(normalizeSession)
    if (normalized.some(item => !item)) throw new Error('Saved workspaces contain invalid data; no changes were made.')
    const next = change(normalized as SavedSession[])
    if (next.length > 50) throw new Error('You can save up to 50 workspaces.')
    await chrome.storage.local.set({ [KEY]: next })
  })
  writes = operation
  return operation
}
