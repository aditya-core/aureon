import { useState } from 'react'
import { closeDuplicates } from '../api'
import { hostname } from '../model'

function DuplicateGroup({ tabs, run }: { tabs: chrome.tabs.Tab[]; run: (action: () => Promise<void | string>, success: string) => Promise<void> }) {
  const [keep, setKeep] = useState(String(tabs[0].id))
  const validKeep = tabs.some(t => String(t.id) === keep) ? keep : String(tabs[0].id)
  return <div className="duplicate-card"><div><strong>{hostname(tabs[0].url)}</strong><small title={tabs[0].url}>{tabs[0].url}</small></div><label>Keep <select value={validKeep} onChange={e => setKeep(e.target.value)}>{tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.title || 'Untitled'} · Window {tab.windowId} · Tab {tab.id}</option>)}</select></label><button className="danger-button" onClick={() => { if (window.confirm(`Close up to ${tabs.length - 1} duplicate tab(s)? The selected tab will be kept. Tabs that changed URLs will be skipped.`)) void run(async () => { const count = await closeDuplicates(tabs, Number(validKeep)); return `Closed ${count} duplicate tab(s). Tabs that changed were skipped.` }, 'Duplicate closure completed.') }}>Close others</button></div>
}
export function DuplicatesPanel({ groups, run }: { groups: chrome.tabs.Tab[][]; run: (action: () => Promise<void | string>, success: string) => Promise<void> }) {
  return <div className="section-stack"><div className="panel-head"><div><span className="kicker">LESS NOISE, MORE FOCUS</span><h2>Find your duplicates<span>.</span></h2><p>Fragments are ignored; query parameters are preserved. Private and normal tabs are never mixed. Nothing closes without confirmation.</p></div></div>{groups.length ? groups.map(group => <DuplicateGroup key={group.map(t => t.id).join(':')} tabs={group} run={run}/>) : <div className="empty">All clear. No duplicate HTTP(S) tabs found.</div>}</div>
}
