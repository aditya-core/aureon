import { useEffect, useState } from 'react'
import { getSessions, updateSessions } from '../storage'
import { restoreSaved } from '../api'
import { hostname, saveableTabs } from '../model'
import type { SavedSession } from '../model'

function SessionCard({ session, refresh, report }: { session: SavedSession; refresh: () => Promise<void>; report: (message: string, error?: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(() => new Set(session.tabs.map((_, i) => i)))
  async function restore(indices: number[]) {
    if (indices.length > 10 && !window.confirm(`Open up to ${indices.length} tabs? Existing matching URLs will be skipped.`)) return
    if (restoring) return
    setRestoring(true)
    try { const result = await restoreSaved(indices.map(i => session.tabs[i]).filter(Boolean)); report(`Opened ${result.opened}; skipped ${result.skipped} already-open or unsupported URLs; ${result.failed} operation(s) failed.`, result.failed > 0) } catch (error) { report(error instanceof Error ? error.message : 'Could not restore this workspace.', true) } finally { setRestoring(false) }
  }
  async function modify(fn: (all: SavedSession[]) => SavedSession[]) { try { await updateSessions(fn); await refresh(); report('Workspace saved locally.') } catch (error) { report(error instanceof Error ? error.message : 'Could not save workspace.', true) } }
  return <div className="workspace-card"><div className="workspace-header"><div className="workspace-icon">✳</div><div><strong>{session.name}</strong><small>{session.tabs.length} tabs · Saved {new Date(session.createdAt).toLocaleDateString()}</small></div><button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Details'}</button></div><div className="workspace-actions"><button className="primary" disabled={restoring} onClick={() => void restore(session.tabs.map((_,i) => i))}>{restoring ? 'Restoring…' : 'Restore all'}</button><button onClick={() => { const name = window.prompt('Rename workspace', session.name)?.trim(); if (name) void modify(all => all.map(item => item.id === session.id ? { ...item, name: name.slice(0,80), updatedAt: Date.now() } : item)) }}>Rename</button><button className="danger-button" onClick={() => { if (window.confirm(`Delete “${session.name}”? Open tabs will not be closed.`)) void modify(all => all.filter(item => item.id !== session.id)) }}>Delete</button></div>{open && <div className="saved-tabs">{session.tabs.map((tab, i) => <label key={`${tab.url}:${i}`}><input type="checkbox" checked={checked.has(i)} onChange={e => setChecked(prev => { const next = new Set(prev); if (e.target.checked) next.add(i); else next.delete(i); return next })}/><span><strong>{tab.title || hostname(tab.url)}</strong><small>{tab.url}</small></span></label>)}<button disabled={!checked.size || restoring} onClick={() => void restore([...checked])}>Restore selected ({checked.size})</button></div>}</div>
}
export function SessionsPanel({ tabs, groups, selected, windowId, report }: { tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[]; selected: Set<number>; windowId?: number; report: (message: string, error?: boolean) => void }) {
  const [sessions, setSessions] = useState<SavedSession[]>([])
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  async function refresh() { const result = await getSessions(); setSessions(result); setReady(true) }
  useEffect(() => {
    let active = true
    const load = () => { void getSessions().then(result => { if (active) { setSessions(result); setReady(true) } }).catch(error => { if (active) report(error instanceof Error ? error.message : 'Could not load saved workspaces.', true) }) }
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === 'local' && changes['nova:savedSessions']) load() }
    load(); chrome.storage.onChanged.addListener(changed)
    return () => { active = false; chrome.storage.onChanged.removeListener(changed) }
  }, [report])
  async function save(source: chrome.tabs.Tab[]) {
    if (!name.trim()) { report('Enter a workspace name first.', true); return }
    const captured = saveableTabs(source, groups)
    if (!captured.tabs.length) { report('No supported non-incognito HTTP(S) tabs to save.', true); return }
    if (captured.tabs.length > 500) { report('A workspace can contain at most 500 tabs.', true); return }
    const now = Date.now(), session: SavedSession = { id: crypto.randomUUID(), name: name.trim().slice(0,80), createdAt: now, updatedAt: now, tabs: captured.tabs }
    try { await updateSessions(all => [session, ...all]); setName(''); await refresh(); report(`Saved ${captured.tabs.length} tabs${captured.skipped ? `; skipped ${captured.skipped} private or unsupported tabs` : ''}.`) } catch (error) { report(error instanceof Error ? error.message : 'Could not save workspace.', true) }
  }
  return <div className="section-stack"><div className="panel-head"><div><span className="kicker">KEEP THE THREAD</span><h2>Your workspaces<span>.</span></h2><p>Save a moment in your browser and return to it when you’re ready.</p></div></div><div className="panel save-panel"><label className="field">Workspace name<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="e.g. College research"/></label><div className="inline-actions"><button className="primary" disabled={!ready || !name.trim() || windowId === undefined} onClick={() => void save(tabs.filter(tab => tab.windowId === windowId))}>Save current window</button><button disabled={!ready || !name.trim() || !selected.size} onClick={() => void save(tabs.filter(tab => tab.id !== undefined && selected.has(tab.id)))}>Save selected ({selected.size})</button></div><p className="hint">Only HTTP(S) tabs are saved. Incognito and browser pages are excluded. URLs may contain sensitive information and remain in local storage.</p></div><h3 className="subheading">SAVED WORKSPACES <span>{sessions.length}</span></h3>{ready && !sessions.length ? <div className="empty">No saved workspaces yet. Your next project can start here.</div> : sessions.map(session => <SessionCard key={session.id} session={session} refresh={refresh} report={report}/>)}{!ready && <p className="hint">Loading workspaces…</p>}</div>
}
