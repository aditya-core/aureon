import { useEffect, useState } from 'react'
import { Pin, Plus, Trash2 } from 'lucide-react'
import { useLocalList } from '../hooks/useLocalList'
import { getNotes, saveNotes } from '../lib/storage'

export function Notes() {
  const { items: notes, change, ready, error } = useLocalList(getNotes, saveNotes, 500)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { if (!selected && notes.length) setSelected(notes[0].id) }, [selected, notes])
  const active = notes.find(note => note.id === selected)
  const visible = notes.filter(note => `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  function update(patch: { title?: string; content?: string; pinned?: boolean }) { if (active) change(list => list.map(note => note.id === active.id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note)) }
  return <section className="widget productivity-widget" aria-labelledby="notes-heading"><div className="widget-heading"><div><span className="widget-kicker">A LITTLE SPACE FOR IDEAS</span><h2 id="notes-heading">Notes</h2></div><button className="icon-button small" disabled={!ready} aria-label="Create note" onClick={() => { const now = new Date().toISOString(); const id = crypto.randomUUID(); change(list => [{ id, title: '', content: '', createdAt: now, updatedAt: now }, ...list]); setSelected(id) }}><Plus size={17}/></button></div>
    {error && <p className="widget-error" role="alert">{error}</p>}{!ready && !error && <p className="helper">Loading notes…</p>}
    {ready && notes.length === 0 && <p className="empty-state">A little space for your thoughts. Create your first note.</p>}
    {notes.length > 0 && <><input className="widget-input note-search" aria-label="Search notes" placeholder="Search notes" value={query} onChange={e => setQuery(e.target.value)}/><div className="note-list" aria-label="Notes list">{visible.map(note => <button key={note.id} className={note.id === selected ? 'active' : ''} onClick={() => setSelected(note.id)} aria-pressed={note.id === selected}>{note.pinned && '📌 '}{note.title || 'Untitled note'}</button>)}{visible.length === 0 && <span className="helper">No notes match your search.</span>}</div></>}
    {active && <div className="note-editor"><div className="note-toolbar"><input className="widget-input" aria-label="Note title" maxLength={100} placeholder="Untitled note" value={active.title} onChange={e => update({ title: e.target.value })}/><button className="icon-button small" aria-label={active.pinned ? 'Unpin note' : 'Pin note'} aria-pressed={!!active.pinned} onClick={() => update({ pinned: !active.pinned })}><Pin size={15}/></button><button className="icon-button small" aria-label="Delete note" onClick={() => { if (window.confirm('Delete this note?')) { change(list => list.filter(note => note.id !== active.id)); setSelected(null) } }}><Trash2 size={15}/></button></div><textarea aria-label="Note content" placeholder="Let your thoughts land here…" value={active.content} onChange={e => update({ content: e.target.value })}/><span className="widget-caption">AUTOSAVED LOCALLY · {new Date(active.updatedAt).toLocaleDateString()}</span></div>}
  </section>
}
