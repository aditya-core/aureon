import { duplicateKey, safeUrl } from './model'
import type { SavedTab } from './model'
export async function focusTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined || tab.windowId === undefined) throw new Error('This tab is no longer available.')
  await chrome.tabs.update(tab.id, { active: true }); await chrome.windows.update(tab.windowId, { focused: true })
}
export async function closeTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined) throw new Error('This tab is no longer available.')
  await chrome.tabs.remove(tab.id)
}
export async function createGroup(tabs: chrome.tabs.Tab[], title: string, color: chrome.tabGroups.ColorEnum) {
  const eligible = tabs.filter(t => t.id !== undefined && !t.pinned)
  if (!eligible.length || eligible.length !== tabs.length) throw new Error('Select unpinned tabs to group.')
  if (new Set(eligible.map(t => t.windowId)).size !== 1) throw new Error('Native groups must be within one window.')
  const groupId = await chrome.tabs.group({ tabIds: eligible.map(t => t.id!), createProperties: { windowId: eligible[0].windowId } })
  await chrome.tabGroups.update(groupId, { title: title.trim().slice(0, 80) || 'Group', color })
}
export async function addToGroup(tabs: chrome.tabs.Tab[], group: chrome.tabGroups.TabGroup) {
  if (!tabs.length || tabs.some(t => t.id === undefined || t.pinned || t.windowId !== group.windowId)) throw new Error('Choose unpinned tabs in the same window as this group.')
  await chrome.tabs.group({ tabIds: tabs.map(t => t.id!), groupId: group.id })
}
export async function restoreSaved(tabs: SavedTab[]): Promise<{ opened: number; skipped: number; failed: number }> {
  const [existing, window] = await Promise.all([chrome.tabs.query({}), chrome.windows.getCurrent()])
  if (window.incognito || window.id === undefined) throw new Error('Open NOVA in a normal window to restore a workspace.')
  const seen = new Set(existing.filter(t => !t.incognito).map(t => duplicateKey(t.url)).filter((v): v is string => !!v))
  let opened = 0, skipped = 0, failed = 0
  const grouped = new Map<string, { name: string; color: chrome.tabGroups.ColorEnum; ids: number[] }>()
  for (const tab of tabs) {
    const url = safeUrl(tab.url), key = duplicateKey(url)
    if (!url || !key || seen.has(key)) { skipped++; continue }
    try {
      const created = await chrome.tabs.create({ windowId: window.id, url, active: false, pinned: tab.pinned === true })
      seen.add(key); opened++
      if (created.id !== undefined && tab.groupName && !tab.pinned) {
        const color = tab.groupColor ?? 'grey', groupKey = tab.groupKey ? `id:${tab.groupKey}` : `legacy:${tab.groupName}\u0000${color}`
        const group = grouped.get(groupKey) ?? { name: tab.groupName, color, ids: [] }; group.ids.push(created.id); grouped.set(groupKey, group)
      }
    } catch { failed++ }
  }
  for (const group of grouped.values()) {
    try { const id = await chrome.tabs.group({ tabIds: group.ids, createProperties: { windowId: window.id } }); await chrome.tabGroups.update(id, { title: group.name, color: group.color }) } catch { failed++ }
  }
  return { opened, skipped, failed }
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
