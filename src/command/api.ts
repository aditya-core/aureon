import { duplicateKey, safeUrl } from './model'
import type { SavedTab } from './model'
export async function focusTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined || tab.windowId === undefined) throw new Error('This tab is no longer available.')
  await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true })
}
export async function restoreRecent(id: string) { await chrome.sessions.restore(id) }
export async function closeTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined) throw new Error('This tab is no longer available.')
  await chrome.tabs.remove(tab.id)
}
export async function createGroup(tabs: chrome.tabs.Tab[], title: string, color: chrome.tabGroups.ColorEnum) {
  const eligible = tabs.filter(t => t.id !== undefined && !t.pinned)
  if (!eligible.length || eligible.length !== tabs.length) throw new Error('Select unpinned tabs to group.')
  if (new Set(eligible.map(t => t.windowId)).size !== 1) throw new Error('Native groups must be within one window.')
  const groupId = await chrome.tabs.group({ tabIds: eligible.map(t => t.id!), createProperties: { windowId: eligible[0].windowId } })
  try { await chrome.tabGroups.update(groupId, { title: title.trim().slice(0, 80) || 'Group', color }) } catch { throw new Error('The group was created, but its name or color could not be updated.') }
}
export async function addToGroup(tabs: chrome.tabs.Tab[], group: chrome.tabGroups.TabGroup) {
  if (!tabs.length || tabs.some(t => t.id === undefined || t.pinned || t.windowId !== group.windowId)) throw new Error('Choose unpinned tabs in the same window as this group.')
  await chrome.tabs.group({ tabIds: tabs.map(t => t.id!), groupId: group.id })
}
export interface RestoreOptions { destination?: 'current' | 'new'; skipOpen?: boolean; exact?: boolean; includeDetails?: boolean }
export interface RestoreResult { opened: number; skipped: number; failed: number; details?: string[] }
/** Shared session restore service. Defaults preserve Command Centre behavior. */
export async function restoreSaved(tabs: SavedTab[], options: RestoreOptions = {}): Promise<RestoreResult> {
  const [existing, current] = await Promise.all([chrome.tabs.query({}), chrome.windows.getCurrent()])
  if (current.incognito || current.id === undefined) throw new Error('Open NOVA in a normal window to restore a workspace.')
  const keyFor = options.exact ? safeUrl : duplicateKey
  const seen = new Set(existing.filter(t => !t.incognito).map(t => keyFor(t.url)).filter((v): v is string => !!v))
  const skipOpen = options.skipOpen !== false, details: string[] = []
  let opened = 0, skipped = 0, failed = 0, uncertainWindow = false, targetId = options.destination === 'new' ? undefined : current.id
  const grouped = new Map<string, { name: string; color: chrome.tabGroups.ColorEnum; ids: number[] }>()
  for (const tab of tabs) {
    const url = safeUrl(tab.url), key = keyFor(url)
    if (!url || !key || (skipOpen && seen.has(key))) { skipped++; details.push(`Skipped ${tab.url}: ${!url || !key ? 'unsupported URL' : 'already open or repeated'}.`); continue }
    if (uncertainWindow) { failed++; details.push(`Not opened ${url}: the destination window could not be identified.`); continue }
    let created: chrome.tabs.Tab | undefined
    try {
      if (targetId === undefined) {
        const window = await chrome.windows.create({ url, focused: true })
        if (window.id === undefined || window.incognito) { uncertainWindow = true; throw new Error('The window may have opened, but a normal destination could not be identified.') }
        targetId = window.id
        created = window.tabs?.[0]
        // The new window is already a side effect, even if a later lookup fails.
        opened++; seen.add(key); details.push(`Opened ${url}.`)
        if (created?.id === undefined && (tab.pinned || tab.groupName)) {
          try { created = (await chrome.tabs.query({ windowId: targetId }))[0] } catch { /* report missing pin/group below */ }
        }
        if (tab.pinned) {
          if (created?.id === undefined) { failed++; details.push(`Could not pin ${url}: the new tab could not be identified.`) }
          else try { await chrome.tabs.update(created.id, { pinned: true }) } catch { failed++; details.push(`Could not pin ${url}.`) }
        }
      } else {
        created = await chrome.tabs.create({ windowId: targetId, url, active: false, pinned: tab.pinned === true })
        opened++; seen.add(key); details.push(`Opened ${url}.`)
      }
      if (tab.groupName && !tab.pinned) {
        if (created?.id === undefined) { failed++; details.push(`Could not group ${url}: the tab could not be identified.`) }
        else {
          const color = tab.groupColor ?? 'grey', groupKey = tab.groupKey ? `id:${tab.groupKey}` : `legacy:${tab.groupName}\u0000${color}`
          const group = grouped.get(groupKey) ?? { name: tab.groupName, color, ids: [] }; group.ids.push(created.id); grouped.set(groupKey, group)
        }
      }
    } catch (error) { failed++; details.push(`Could not open ${url}: ${error instanceof Error ? error.message : 'browser error'}.`) }
  }
  for (const group of grouped.values()) {
    try { const id = await chrome.tabs.group({ tabIds: group.ids, createProperties: { windowId: targetId! } }); await chrome.tabGroups.update(id, { title: group.name, color: group.color }) }
    catch { failed++; details.push(`Could not finish group “${group.name}”; its tabs may already be open.`) }
  }
  return { opened, skipped, failed, ...(options.includeDetails ? { details } : {}) }
}

export async function closeDuplicates(group: chrome.tabs.Tab[], keepId: number): Promise<number> {
  const original = group.find(tab => tab.id === keepId)
  const key = duplicateKey(original?.url)
  if (!original || !key) throw new Error('The tab to keep is no longer available.')
  const keep = await chrome.tabs.get(keepId)
  if (duplicateKey(keep.url) !== key || keep.incognito !== original.incognito) throw new Error('The tab to keep has changed. Review duplicates again.')
  const ids: number[] = []
  for (const candidate of group) {
    if (candidate.id === undefined || candidate.id === keepId) continue
    try { const live = await chrome.tabs.get(candidate.id); if (duplicateKey(candidate.url) === key && duplicateKey(live.url) === key && live.incognito === keep.incognito) ids.push(candidate.id) } catch { /* tab already closed */ }
  }
  if (ids.length) await chrome.tabs.remove(ids)
  return ids.length
}
