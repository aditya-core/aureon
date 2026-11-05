import { safeUrl, hostname } from '../command/model'

export type Filter = 'all' | 'active' | 'pinned' | 'unpinned' | 'muted' | 'audible' | 'grouped' | 'ungrouped'
export type Sort = 'browser' | 'recent' | 'alphabetical' | 'domain' | 'group'
/** Preserve both the query and fragment. Unsupported or credentialed URLs are never candidates. */
export const exactKey = (url: unknown) => safeUrl(url)
export function exactDuplicates(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[][] {
  const found = new Map<string, chrome.tabs.Tab[]>()
  for (const tab of tabs) {
    const key = exactKey(tab.url)
    if (!key || tab.incognito || tab.id === undefined) continue
    const group = found.get(key) ?? []; group.push(tab); found.set(key, group)
  }
  return [...found.values()].filter(group => group.length > 1)
}
export function filterTabs(tabs: chrome.tabs.Tab[], groups: chrome.tabGroups.TabGroup[], query: string, filter: Filter, groupFilter: string, sort: Sort): chrome.tabs.Tab[] {
  const names = new Map(groups.map(g => [g.id, g.title || 'Untitled group']))
  const q = query.trim().toLocaleLowerCase()
  const filtered = tabs.filter(tab => {
    if (tab.incognito || tab.id === undefined) return false
    if (filter === 'active' && !tab.active || filter === 'pinned' && !tab.pinned || filter === 'unpinned' && tab.pinned || filter === 'muted' && !tab.mutedInfo?.muted || filter === 'audible' && !tab.audible || filter === 'grouped' && tab.groupId === -1 || filter === 'ungrouped' && tab.groupId !== -1) return false
    if (groupFilter === 'ungrouped' && tab.groupId !== -1 || groupFilter !== 'all' && groupFilter !== 'ungrouped' && tab.groupId !== Number(groupFilter)) return false
    return !q || `${tab.title || ''} ${tab.url || ''} ${hostname(tab.url)} ${names.get(tab.groupId) || ''}`.toLocaleLowerCase().includes(q)
  })
  return filtered.sort((a,b) => {
    const fallback = a.windowId - b.windowId || a.index - b.index
    switch (sort) {
      case 'recent': return (b.lastAccessed ?? -1) - (a.lastAccessed ?? -1) || fallback
      case 'alphabetical': return (a.title || '').localeCompare(b.title || '') || fallback
      case 'domain': return hostname(a.url).localeCompare(hostname(b.url)) || fallback
      case 'group': return (names.get(a.groupId) || '￿').localeCompare(names.get(b.groupId) || '￿') || fallback
      default: return fallback
    }
  })
}
export function domainCollections(tabs: chrome.tabs.Tab[]): { domain: string; tabs: chrome.tabs.Tab[]; suggestion: string }[] {
  const map = new Map<string, chrome.tabs.Tab[]>()
  for (const tab of tabs) {
    if (tab.incognito || !safeUrl(tab.url)) continue
    const domain = hostname(tab.url), list = map.get(domain) ?? []; list.push(tab); map.set(domain, list)
  }
  const category = (domain: string) => {
    if (/(^|\.)(github\.com|gitlab\.com|stackoverflow\.com)$/.test(domain)) return 'Development'
    if (/(^|\.)(developer\.mozilla\.org|wikipedia\.org|coursera\.org)$/.test(domain)) return 'Learning'
    if (/(^|\.)(scholar\.google\.com|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov)$/.test(domain)) return 'Research'
    if (/(^|\.)(youtube\.com|netflix\.com)$/.test(domain)) return 'Entertainment'
    if (/(^|\.)(amazon\.com|amazon\.in|ebay\.com)$/.test(domain)) return 'Shopping'
    if (/(^|\.)(reddit\.com|linkedin\.com)$/.test(domain)) return 'Social'
    return 'Uncategorized'
  }
  return [...map].filter(([,list]) => list.length > 1).map(([domain,list]) => ({ domain, tabs:list, suggestion:category(domain) })).sort((a,b) => b.tabs.length - a.tabs.length || a.domain.localeCompare(b.domain))
}
export function inactiveTabs(tabs: chrome.tabs.Tab[], now = Date.now()): chrome.tabs.Tab[] {
  return tabs.filter(tab => !tab.incognito && !tab.active && typeof tab.lastAccessed === 'number' && tab.lastAccessed > 0 && now - tab.lastAccessed >= 7 * 24 * 60 * 60 * 1000)
}
