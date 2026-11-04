import { memo } from 'react'
import { ArrowUpRight, LockKeyhole, Pin, X } from 'lucide-react'
import { duplicateKey, hostname, isInactive, safeUrl } from '../model'

interface Props { tabs: chrome.tabs.Tab[]; groups: chrome.tabGroups.TabGroup[]; selected: Set<number>; duplicateKeys: Set<string>; onSelect: (id: number, checked: boolean) => void; onFocus: (tab: chrome.tabs.Tab) => void; onClose: (tab: chrome.tabs.Tab) => void }
const TabRow = memo(function TabRow({ tab, checked, duplicate, onSelect, onFocus, onClose }: { tab: chrome.tabs.Tab; checked: boolean; duplicate: boolean; onSelect: Props['onSelect']; onFocus: Props['onFocus']; onClose: Props['onClose'] }) {
  const title = tab.title || hostname(tab.url), safe = safeUrl(tab.url)
  const favicon = safe && typeof globalThis.chrome !== 'undefined' ? `${chrome.runtime.getURL('_favicon/')}?pageUrl=${encodeURIComponent(safe)}&size=32` : null
  return <div className="tab-row"><label className="check-wrap"><input type="checkbox" aria-label={`Select ${title}`} checked={checked} disabled={tab.id === undefined} onChange={e => { if (tab.id !== undefined) onSelect(tab.id, e.target.checked) }}/></label><span className="tab-icon">{favicon ? <img src={favicon} alt="" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback') }}/> : title.slice(0, 1).toUpperCase()}</span><button className="tab-open" onClick={() => onFocus(tab)} title={tab.url || ''}><strong>{title}</strong><small>{hostname(tab.url)}{tab.incognito ? ' · Private' : ''}</small></button><div className="tab-badges">{tab.active && <span className="badge active">Active</span>}{isInactive(tab) && <span className="badge">Inactive</span>}{duplicate && <span className="badge duplicate">Duplicate</span>}{tab.pinned && <Pin size={13} aria-label="Pinned"/>}{tab.incognito && <LockKeyhole size={13} aria-label="Incognito"/>}</div><button className="icon" aria-label={`Switch to ${title}`} onClick={() => onFocus(tab)}><ArrowUpRight size={16}/></button><button className="icon danger" aria-label={`Close ${title}`} onClick={() => onClose(tab)}><X size={16}/></button></div>
})
export function TabList(props: Props) {
  const sorted = [...props.tabs].sort((a,b) => a.windowId - b.windowId || a.index - b.index)
  const sections = new Map<string, { label: string; color?: string; tabs: chrome.tabs.Tab[] }>()
  for (const tab of sorted) {
    const group = props.groups.find(g => g.id === tab.groupId)
    const key = `${tab.windowId}:${group?.id ?? -1}`
    const section = sections.get(key) ?? { label: group ? `${group.title || 'Untitled group'} · Window ${tab.windowId}` : `Ungrouped · Window ${tab.windowId}`, color: group?.color, tabs: [] }
    section.tabs.push(tab); sections.set(key, section)
  }
  if (!sorted.length) return <div className="empty">No tabs match your search. Try another title or URL.</div>
  return <div className="tab-sections">{[...sections.entries()].map(([key, section]) => <section key={key} className="tab-section"><h3><span className={`group-dot ${section.color || 'grey'}`}/>{section.label}<span>{section.tabs.length}</span></h3><div className="tab-card">{section.tabs.map(tab => <TabRow key={tab.id} tab={tab} checked={tab.id !== undefined && props.selected.has(tab.id)} duplicate={!!duplicateKey(tab.url) && props.duplicateKeys.has(`${tab.incognito ? 'private' : 'normal'}:${duplicateKey(tab.url)}`)} onSelect={props.onSelect} onFocus={props.onFocus} onClose={props.onClose}/>)}</div></section>)}</div>
}
