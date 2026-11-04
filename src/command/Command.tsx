import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Boxes, Clock3, Copy, FolderOpen, LayoutGrid, RefreshCw, Search, Sparkles } from 'lucide-react'
import { closeTab, createGroup, addToGroup, focusTab } from './api'
import { duplicateKey, duplicates } from './model'
import { useBrowser } from './useBrowser'
import { TabList } from './components/TabList'
import { GroupsPanel } from './components/GroupsPanel'
import { DuplicatesPanel } from './components/DuplicatesPanel'
import { SessionsPanel } from './components/SessionsPanel'
import { RecoveryPanel } from './components/RecoveryPanel'
import { getPreferences } from '../lib/storage'
import { DEFAULT_PREFERENCES } from '../lib/defaults'
import { themeStyles } from '../lib/theme-engine'

type View = 'tabs' | 'groups' | 'duplicates' | 'sessions' | 'recent'
export function Command() {
  const { tabs, groups, recent, windowId, ready, error, refresh, available } = useBrowser()
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  useEffect(() => { let active = true; getPreferences().then(p => { if (active) setPreferences(p) }).catch(() => {}); return () => { active = false } }, [])
  const [view, setView] = useState<View>('tabs')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const duplicateGroups = useMemo(() => duplicates(tabs), [tabs])
  const duplicateKeys = useMemo(() => new Set(duplicateGroups.map(group => `${group[0].incognito ? 'private' : 'normal'}:${duplicateKey(group[0].url)}`)), [duplicateGroups])
  const filtered = useMemo(() => { const q = query.trim().toLocaleLowerCase(); return q ? tabs.filter(t => `${t.title ?? ''} ${t.url ?? ''}`.toLocaleLowerCase().includes(q)) : tabs }, [tabs, query])
  const chosen = useMemo(() => tabs.filter(t => t.id !== undefined && selected.has(t.id)), [tabs, selected])
  const windows = useMemo(() => new Set(tabs.map(tab => tab.windowId)).size, [tabs])
  const report = useCallback((text: string, isError = false) => setFeedback({ text, error: isError }), [])
  const run = useCallback(async (action: () => Promise<void | string>, success: string) => {
    setBusy(true); setFeedback(null)
    try { const result = await action(); report(result || success) } catch (err) { report(err instanceof Error ? err.message : 'That action could not be completed. The tab may have closed.', true) } finally { setBusy(false) }
  }, [report])
  const select = useCallback((id: number, checked: boolean) => setSelected(previous => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next }), [])
  const focus = useCallback((tab: chrome.tabs.Tab) => { void run(() => focusTab(tab), 'Switched to tab.') }, [run])
  const close = useCallback((tab: chrome.tabs.Tab) => { if (window.confirm(`Close “${tab.title || 'this tab'}”?`)) void run(() => closeTab(tab), 'Tab closed.') }, [run])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = target?.matches('input,textarea,select,[contenteditable="true"]')
      if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !editing)) { event.preventDefault(); setView('tabs'); requestAnimationFrame(() => search.current?.focus()) }
      else if (event.key === 'Escape' && target === search.current) { setQuery(''); search.current?.blur() }
    }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [])
  const navigation: { id: View; label: string; icon: typeof LayoutGrid; count?: number }[] = [
    { id: 'tabs', label: 'All tabs', icon: LayoutGrid, count: tabs.length }, { id: 'groups', label: 'Tab groups', icon: Boxes, count: groups.length }, { id: 'duplicates', label: 'Duplicates', icon: Copy, count: duplicateGroups.reduce((n, group) => n + group.length - 1, 0) }, { id: 'sessions', label: 'Workspaces', icon: FolderOpen }, { id: 'recent', label: 'Recently closed', icon: Clock3, count: recent.length },
  ]
  return <div className="command-shell" style={themeStyles(preferences)}><aside className="sidebar"><a href="./index.html" className="command-brand"><span className="brand-mark"><Sparkles size={18}/></span><span>NOVA <small>COMMAND CENTRE</small></span></a><div className="sidebar-label">YOUR SPACE</div><nav aria-label="Command Centre sections">{navigation.map(item => <button key={item.id} className={view === item.id ? 'nav-active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><item.icon size={17}/><span>{item.label}</span>{item.count !== undefined && <small>{item.count}</small>}</button>)}</nav><div className="sidebar-note"><span>✳</span><strong>A clearer browser.</strong><p>Everything here stays yours. Nothing is closed or saved without you.</p></div></aside>
    <main className="command-main"><header className="topline"><div><span className="top-dot"/> YOUR BROWSER, IN BALANCE</div><button onClick={() => void refresh()} disabled={!ready || busy}><RefreshCw size={14}/> Refresh</button></header><div className="main-content"><div className="page-intro"><div><span className="kicker">A LITTLE MORE CLARITY, EVERY DAY</span><h1>Make room to <em>think.</em></h1><p>A quieter place to organize the tabs, ideas, and work you want to return to.</p></div><div className="intro-symbol" aria-hidden="true">✳</div></div>
      <div className="stats"><div><span>OPEN TABS</span><strong>{tabs.length}</strong><small>Across {windows} {windows === 1 ? 'window' : 'windows'}</small></div><div><span>YOUR GROUPS</span><strong>{groups.length}</strong><small>Native Chrome groups</small></div><div><span>EXTRA DUPLICATES</span><strong>{duplicateGroups.reduce((n,g) => n + g.length - 1, 0)}</strong><small>Ready for review</small></div></div>
      {(error || feedback) && <p className={`feedback ${error || feedback?.error ? 'error' : ''}`} role={error || feedback?.error ? 'alert' : 'status'}>{error || feedback?.text}</p>}
      {!ready ? <div className="empty" role="status">Gathering your browser…</div> : available ? <fieldset className="content-fieldset" disabled={busy}>
        {view === 'tabs' && <div className="section-stack"><div className="panel-head"><div><span className="kicker">EVERYTHING IN ITS PLACE</span><h2>Your open tabs<span>.</span></h2><p>Search, select and move between everything you have open.</p></div><div className="head-actions"><button onClick={() => setView('sessions')}><FolderOpen size={15}/> Save session</button><button onClick={() => setView('duplicates')}><Copy size={15}/> Find duplicates</button></div></div><div className="search-box"><Search size={18}/><input ref={search} aria-label="Search tabs by title or URL" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your tabs by title or URL…"/><kbd>⌘ K /</kbd></div><div className="selection-bar"><span>{filtered.length} {filtered.length === 1 ? 'tab' : 'tabs'} shown · {chosen.length} selected</span><button onClick={() => setSelected(new Set(filtered.flatMap(t => t.id === undefined ? [] : [t.id])))}>Select shown</button><button onClick={() => setSelected(new Set())} disabled={!chosen.length}>Clear</button><button onClick={() => setView('groups')} disabled={!chosen.length}>Group selected <ArrowUpRight size={13}/></button></div><TabList tabs={filtered} groups={groups} selected={selected} duplicateKeys={duplicateKeys} onSelect={select} onFocus={focus} onClose={close}/></div>}
        {view === 'groups' && <GroupsPanel groups={groups} selected={chosen} run={run} create={(name,color) => run(() => createGroup(chosen,name,color), 'Group created in Chrome.')} add={group => run(() => addToGroup(chosen,group), 'Tabs added to group.')}/>}
        {view === 'duplicates' && <DuplicatesPanel groups={duplicateGroups} run={run}/>}
        {view === 'sessions' && <SessionsPanel tabs={tabs} groups={groups} selected={selected} windowId={windowId} report={report}/>}
        {view === 'recent' && <RecoveryPanel items={recent} run={run}/>}
      </fieldset> : <div className="empty">Browser controls are available in the installed extension.</div>}
      <footer className="command-footer"><span>✳ &nbsp; MADE FOR A MORE MINDFUL INTERNET</span><span>LOCAL BY DESIGN &nbsp; / &nbsp; NOVA 06</span></footer>
    </div></main></div>
}
