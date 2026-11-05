import { useCallback, useEffect, useRef, useState } from 'react'

export function useBrowser(enabled = true) {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([])
  const [recent, setRecent] = useState<chrome.sessions.Session[]>([])
  const [windowId, setWindowId] = useState<number | undefined>()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const available = !!globalThis.chrome?.tabs?.query && !!globalThis.chrome?.tabGroups && !!globalThis.chrome?.sessions && !!globalThis.chrome?.windows && !!globalThis.chrome?.storage?.local
  const mounted = useRef(false)
  const revision = useRef(0)
  const request = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const refresh = useCallback(async () => {
    if (!available) { setError('Open Command Centre from the installed Chrome extension.'); setReady(true); return }
    const currentRequest = ++request.current, startRevision = revision.current
    try {
      const [allTabs, allGroups, closed, current] = await Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({}), chrome.sessions.getRecentlyClosed({ maxResults: 25 }), chrome.windows.getCurrent()])
      if (!mounted.current || currentRequest !== request.current) return
      if (startRevision !== revision.current) {
        if (retry.current) clearTimeout(retry.current)
        retry.current = setTimeout(() => { if (mounted.current) void refresh() }, 150)
        return
      }
      setTabs(allTabs); setGroups(allGroups); setRecent(closed.filter(item => !item.tab?.incognito && !item.window?.incognito && !item.window?.tabs?.some(t => t.incognito))); setWindowId(current.id); setError(''); setReady(true)
    } catch (err) { if (mounted.current && currentRequest === request.current) { setError(err instanceof Error ? err.message : 'Could not read browser tabs.'); setReady(true) } }
  }, [available])
  useEffect(() => {
    mounted.current = true
    if (!enabled) return () => { mounted.current = false; request.current++ }
    setReady(false)
    if (!available) { void refresh(); return () => { mounted.current = false } }
    let effectActive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let recentTimer: ReturnType<typeof setTimeout> | undefined
    const changed = () => { revision.current++ }
    // Only complex attach/detach/replacement events need a full re-query.
    const resync = () => { changed(); if (timer) clearTimeout(timer); timer = setTimeout(() => { void refresh() }, 150) }
    const upsert = (tab: chrome.tabs.Tab) => setTabs(previous => { const i = previous.findIndex(t => t.id === tab.id); if (i < 0) return [...previous, tab]; const next = [...previous]; next[i] = tab; return next })
    const created = (tab: chrome.tabs.Tab) => { changed(); setTabs(previous => { if (previous.some(t => t.id === tab.id)) return previous.map(t => t.id === tab.id ? tab : t); return [...previous.map(t => t.windowId === tab.windowId && t.index >= tab.index ? { ...t, index: t.index + 1 } : t), tab] }) }
    const updated = (_id: number, _changes: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => { changed(); upsert(tab) }
    const removed = (id: number) => { changed(); setTabs(previous => { const removedTab = previous.find(t => t.id === id); return previous.filter(t => t.id !== id).map(t => removedTab && t.windowId === removedTab.windowId && t.index > removedTab.index ? { ...t, index: t.index - 1 } : t) }) }
    const activated = (info: chrome.tabs.TabActiveInfo) => { changed(); setTabs(previous => previous.map(t => { if (t.windowId !== info.windowId) return t; const active = t.id === info.tabId; return active ? { ...t, active, lastAccessed: Date.now() } : t.active ? { ...t, active: false } : t })) }
    const moved = (id: number, info: chrome.tabs.TabMoveInfo) => { changed(); setTabs(previous => previous.map(t => {
      if (t.windowId !== info.windowId) return t
      if (t.id === id) return { ...t, index: info.toIndex }
      if (info.fromIndex < info.toIndex && t.index > info.fromIndex && t.index <= info.toIndex) return { ...t, index: t.index - 1 }
      if (info.fromIndex > info.toIndex && t.index >= info.toIndex && t.index < info.fromIndex) return { ...t, index: t.index + 1 }
      return t
    })) }
    const upsertGroup = (group: chrome.tabGroups.TabGroup) => { changed(); setGroups(previous => [...previous.filter(g => g.id !== group.id), group]) }
    const removeGroup = (group: chrome.tabGroups.TabGroup) => { changed(); setGroups(previous => previous.filter(g => g.id !== group.id)) }
    const recentChanged = () => { changed(); if (recentTimer) clearTimeout(recentTimer); recentTimer = setTimeout(() => { void chrome.sessions.getRecentlyClosed({ maxResults: 25 }).then(items => { if (effectActive && mounted.current) setRecent(items.filter(item => !item.tab?.incognito && !item.window?.incognito && !item.window?.tabs?.some(t => t.incognito))) }).catch(() => { if (effectActive && mounted.current) setError('Could not refresh recently closed items.') }) }, 150) }
    chrome.tabs.onCreated.addListener(created); chrome.tabs.onUpdated.addListener(updated); chrome.tabs.onRemoved.addListener(removed); chrome.tabs.onActivated.addListener(activated); chrome.tabs.onMoved.addListener(moved)
    chrome.tabs.onAttached.addListener(resync); chrome.tabs.onDetached.addListener(resync); chrome.tabs.onReplaced.addListener(resync)
    chrome.tabGroups.onCreated.addListener(upsertGroup); chrome.tabGroups.onUpdated.addListener(upsertGroup); chrome.tabGroups.onMoved.addListener(upsertGroup); chrome.tabGroups.onRemoved.addListener(removeGroup)
    chrome.sessions.onChanged.addListener(recentChanged)
    const windowRemoved = (id: number) => { changed(); setTabs(previous => previous.filter(tab => tab.windowId !== id)); setGroups(previous => previous.filter(group => group.windowId !== id)); resync() }
    const windowCreated = () => resync()
    chrome.windows.onRemoved?.addListener(windowRemoved); chrome.windows.onCreated?.addListener(windowCreated)
    void refresh()
    return () => {
      effectActive = false; mounted.current = false; request.current++; if (timer) clearTimeout(timer); if (recentTimer) clearTimeout(recentTimer); if (retry.current) clearTimeout(retry.current)
      chrome.tabs.onCreated.removeListener(created); chrome.tabs.onUpdated.removeListener(updated); chrome.tabs.onRemoved.removeListener(removed); chrome.tabs.onActivated.removeListener(activated); chrome.tabs.onMoved.removeListener(moved)
      chrome.tabs.onAttached.removeListener(resync); chrome.tabs.onDetached.removeListener(resync); chrome.tabs.onReplaced.removeListener(resync)
      chrome.tabGroups.onCreated.removeListener(upsertGroup); chrome.tabGroups.onUpdated.removeListener(upsertGroup); chrome.tabGroups.onMoved.removeListener(upsertGroup); chrome.tabGroups.onRemoved.removeListener(removeGroup)
      chrome.sessions.onChanged.removeListener(recentChanged)
      chrome.windows.onRemoved?.removeListener(windowRemoved); chrome.windows.onCreated?.removeListener(windowCreated)
    }
  }, [refresh, enabled])
  return { tabs, groups, recent, windowId, ready, error, refresh, available }
}
