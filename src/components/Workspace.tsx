import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getNotes, getTasks, saveNotes, saveTasks } from '../lib/storage'
import type { Note, Task, Widget } from '../lib/types'

export function Workspace({ visible }: { visible: Widget[] }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [draft, setDraft] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const latestNotes = useRef<Note[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const noteQueue = useRef<Promise<void>>(Promise.resolve())
  const taskQueue = useRef<Promise<void>>(Promise.resolve())
  const active = useRef(true)
  function persistNotes() {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = undefined
    const snapshot = latestNotes.current
    noteQueue.current = noteQueue.current.catch(() => {}).then(() => saveNotes(snapshot)).catch(() => { if (active.current) setError('Could not save your note.') })
  }
  useEffect(() => {
    let mounted = true
    active.current = true
    Promise.all([getNotes(), getTasks()]).then(([n, t]) => { if (mounted) { setNotes(n); latestNotes.current = n; setTasks(t); setReady(true) } }).catch(() => { if (mounted) setError('Could not load your notes and tasks.') })
    window.addEventListener('pagehide', persistNotes)
    return () => { mounted = false; active.current = false; window.removeEventListener('pagehide', persistNotes); persistNotes() }
  }, [])
  const noteText = notes[0]?.content ?? ''
  function updateNote(content: string) {
    const now = new Date().toISOString()
    const next = notes.length ? [{ ...notes[0], content, updatedAt: now }, ...notes.slice(1)] : [{ id: crypto.randomUUID(), title: 'Quick note', content, createdAt: now, updatedAt: now }]
    setNotes(next); latestNotes.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(persistNotes, 500)
  }
  function updateTasks(next: Task[]) { setTasks(next); taskQueue.current = taskQueue.current.catch(() => {}).then(() => saveTasks(next)).catch(() => { if (active.current) setError('Could not save your tasks.') }) }
  if (!visible.includes('notes') && !visible.includes('tasks')) return null
  return <section className="workspace" aria-label="Workspace widgets">
    {visible.includes('notes') && <div className="widget"><div className="widget-heading"><div><span className="widget-kicker">A LITTLE SPACE FOR IDEAS</span><h2>Quick note</h2></div><span className="widget-number">01</span></div><textarea aria-label="Quick note" disabled={!ready} placeholder="Let your thoughts land here..." value={noteText} onChange={e => updateNote(e.target.value)} /><span className="widget-caption">SAVED LOCALLY, JUST FOR YOU</span></div>}
    {visible.includes('tasks') && <div className="widget"><div className="widget-heading"><div><span className="widget-kicker">ONE THING AT A TIME</span><h2>Today’s intentions</h2></div><span className="widget-number">02</span></div><ul className="task-list">{tasks.map(task => <li key={task.id}><label><input type="checkbox" checked={task.completed} onChange={e => updateTasks(tasks.map(t => t.id === task.id ? { ...t, completed: e.target.checked } : t))} /><span className={task.completed ? 'done' : ''}>{task.title}</span></label><button className="icon-button small" aria-label={`Delete ${task.title}`} onClick={() => updateTasks(tasks.filter(t => t.id !== task.id))}><Trash2 size={14}/></button></li>)}</ul><form className="task-form" onSubmit={e => { e.preventDefault(); const title = draft.trim(); if (!title) return; updateTasks([...tasks, { id: crypto.randomUUID(), title, completed: false, createdAt: new Date().toISOString() }]); setDraft('') }}><input value={draft} onChange={e => setDraft(e.target.value)} aria-label="New task" placeholder="Add an intention..." disabled={!ready} maxLength={120}/><button aria-label="Add task" disabled={!ready || !draft.trim()}><Plus size={17}/></button></form></div>}
    {error && <p role="alert" className="widget-error">{error}</p>}
  </section>
}
