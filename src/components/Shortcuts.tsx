import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useLocalList } from '../hooks/useLocalList'
import { getInitialShortcuts, saveShortcuts } from '../lib/storage'
import { validateShortcutUrl } from '../lib/shortcuts'
import type { Shortcut } from '../lib/types'

export function Shortcuts({ initialOrder }: { initialOrder: string[] }) {
  // Only used on first mount to migrate the old starter links.
  const [order] = useState(initialOrder)
  const load = useCallback(() => getInitialShortcuts(order), [order])
  const { items, change, ready, error } = useLocalList(load, saveShortcuts)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [icon, setIcon] = useState('')
  const [category, setCategory] = useState('')
  const [favicon, setFavicon] = useState(false)
  const [formError, setFormError] = useState('')
  const [filter, setFilter] = useState('All')
  function edit(item?: Shortcut) { setEditing(item?.id ?? null); setTitle(item?.title ?? ''); setUrl(item?.url ?? ''); setIcon(item?.icon ?? ''); setCategory(item?.category ?? ''); setFavicon(item?.useFavicon ?? false); setFormError(''); setShowForm(true) }
  function move(id: string, direction: number) { change(list => { const next = [...list]; const i = next.findIndex(x => x.id === id); const j = i + direction; if (i < 0 || j < 0 || j >= next.length) return next; [next[i], next[j]] = [next[j], next[i]]; return next.map((item, position) => ({ ...item, position })) }) }
  const categories = [...new Set(items.map(item => item.category).filter((item): item is string => !!item))]
  return <section className="quick-access" aria-labelledby="quick-title"><div className="section-heading"><h2 id="quick-title">QUICK ACCESS</h2><button className="widget-action" onClick={() => edit()} disabled={!ready}><Plus size={14}/> Add shortcut</button></div>
    {categories.length > 0 && <label className="filter-label">Category <select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{categories.map(x => <option key={x}>{x}</option>)}</select></label>}
    {!ready && !error && <p className="helper">Loading shortcuts…</p>}{error && <p role="alert" className="widget-error">{error}</p>}
    {ready && items.length === 0 && <p className="empty-state">Your favorite places can live here. Add your first shortcut.</p>}
    <div className="quick-grid">{items.filter(item => filter === 'All' || item.category === filter).map(item => { const i = items.findIndex(x => x.id === item.id); return <div key={item.id} className="shortcut-card"><a className="quick-link" href={item.url}><span className="quick-icon">{item.useFavicon ? <img src={`${new URL(item.url).origin}/favicon.ico`} alt="" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('favicon-fallback') }}/> : (item.icon || item.title.charAt(0).toUpperCase())}</span><span className="quick-label">{item.title}</span><ArrowUpRight className="quick-arrow" size={14} aria-hidden="true"/></a><div className="shortcut-tools"><button aria-label={`Move ${item.title} earlier`} disabled={i === 0} onClick={() => move(item.id,-1)}><ArrowUp size={13}/></button><button aria-label={`Move ${item.title} later`} disabled={i === items.length-1} onClick={() => move(item.id,1)}><ArrowDown size={13}/></button><button aria-label={`Edit ${item.title}`} onClick={() => edit(item)}><Pencil size={13}/></button><button aria-label={`Delete ${item.title}`} onClick={() => { if (window.confirm(`Remove ${item.title}?`)) change(list => list.filter(x => x.id !== item.id)) }}><Trash2 size={13}/></button></div></div> })}</div>
    {showForm && <form className="inline-editor" onSubmit={e => { e.preventDefault(); const valid = validateShortcutUrl(url); if (!valid || !title.trim()) { setFormError('Enter a name and a valid HTTP or HTTPS address.'); return } const entry: Shortcut = { id: editing ?? crypto.randomUUID(), title: title.trim().slice(0,60), url: valid, icon: icon.trim().slice(0,4) || null, category: category.trim().slice(0,30), useFavicon: favicon, position: editing ? items.findIndex(x => x.id === editing) : items.length }; change(list => editing ? list.map(x => x.id === editing ? entry : x) : [...list, entry]); setShowForm(false) }}><h3>{editing ? 'Edit shortcut' : 'Add a shortcut'}</h3><label>Name<input required maxLength={60} value={title} onChange={e => setTitle(e.target.value)}/></label><label>Website<input required value={url} onChange={e => setUrl(e.target.value)} placeholder="example.com"/></label><div className="editor-row"><label>Icon text<input maxLength={4} value={icon} onChange={e => setIcon(e.target.value)} placeholder="Optional"/></label><label>Category<input maxLength={30} value={category} onChange={e => setCategory(e.target.value)} placeholder="Optional"/></label></div><label className="check-label"><input type="checkbox" checked={favicon} onChange={e => setFavicon(e.target.checked)}/> Use site favicon (contacts this website)</label>{formError && <p role="alert" className="widget-error">{formError}</p>}<div className="editor-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit">Save shortcut</button></div></form>}
  </section>
}
