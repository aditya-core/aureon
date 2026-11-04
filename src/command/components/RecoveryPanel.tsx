import { RotateCcw } from 'lucide-react'
import { hostname } from '../model'
export function RecoveryPanel({ items, run }: { items: chrome.sessions.Session[]; run: (action: () => Promise<void>, success: string) => Promise<void> }) {
  return <div className="section-stack"><div className="panel-head"><div><span className="kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Recently closed<span>.</span></h2><p>From Chrome’s own recent sessions. No separate browsing history is stored.</p></div></div><div className="panel">{!items.length ? <div className="empty">No recently closed tabs or windows available.</div> : items.map((item, index) => {
    const id = item.tab?.sessionId ?? item.window?.sessionId
    const title = item.tab ? item.tab.title || hostname(item.tab.url) : `Closed window · ${item.window?.tabs?.length ?? 0} tabs`
    return <div className="recovery-row" key={id ?? index}><div><strong>{title}</strong><small>{item.tab ? hostname(item.tab.url) : 'Chrome window'} · {new Date(item.lastModified < 1e12 ? item.lastModified * 1000 : item.lastModified).toLocaleString()}</small></div><button disabled={!id} onClick={() => { if (id && (!item.window || window.confirm('Restore this recently closed window and its tabs?'))) void run(async () => { await chrome.sessions.restore(id) }, 'Restored from Chrome’s recent sessions.') }}><RotateCcw size={14}/> Restore</button></div>
  })}</div></div>
}
