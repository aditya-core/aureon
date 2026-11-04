import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useLocalList } from '../hooks/useLocalList'
import { getTasks, saveTasks } from '../lib/storage'
import type { Task } from '../lib/types'

export function Tasks() {
  const { items: tasks, change, ready, error } = useLocalList(getTasks, saveTasks)
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState<NonNullable<Task['priority']>>('medium')
  const [date, setDate] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all'|'pending'|'completed'>('all')
  const visible = tasks.filter(task => filter === 'all' || (filter === 'completed' ? task.completed : !task.completed))
  function edit(task: Task) { setEditing(task.id); setDraft(task.title); setPriority(task.priority ?? 'medium'); setDate(task.dueDate ?? '') }
  function clear() { setEditing(null); setDraft(''); setPriority('medium'); setDate('') }
  return <section className="widget productivity-widget" aria-labelledby="tasks-heading"><div className="widget-heading"><div><span className="widget-kicker">ONE THING AT A TIME</span><h2 id="tasks-heading">Today’s intentions</h2></div><span className="widget-number">{tasks.filter(t => t.completed).length} DONE</span></div>
    {error && <p className="widget-error" role="alert">{error}</p>}{!ready && !error && <p className="helper">Loading tasks…</p>}
    <div className="task-filters" aria-label="Task filter">{(['all','pending','completed'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
    {ready && visible.length === 0 && <p className="empty-state">{tasks.length ? 'Nothing in this view.' : 'What matters most today?'}</p>}
    <ul className="task-list">{visible.map(task => <li key={task.id}><label><input type="checkbox" checked={task.completed} onChange={e => change(list => list.map(t => t.id === task.id ? { ...t, completed: e.target.checked } : t))}/><span className={task.completed ? 'done' : ''}>{task.title}<small className="task-meta">{task.priority ?? 'medium'}{task.dueDate ? ` · ${task.dueDate}` : ''}</small></span></label><div className="task-actions"><button className="icon-button small" aria-label={`Edit ${task.title}`} onClick={() => edit(task)}><Pencil size={13}/></button><button className="icon-button small" aria-label={`Delete ${task.title}`} onClick={() => { if (window.confirm(`Delete ${task.title}?`)) change(list => list.filter(t => t.id !== task.id)) }}><Trash2 size={14}/></button></div></li>)}</ul>
    <form className="task-editor" onSubmit={e => { e.preventDefault(); const title = draft.trim(); if (!title) return; if (editing) change(list => list.map(t => t.id === editing ? { ...t, title, priority, dueDate: date } : t)); else change(list => [...list, { id: crypto.randomUUID(), title, completed: false, createdAt: new Date().toISOString(), priority, dueDate: date }]); clear() }}><input className="widget-input" value={draft} onChange={e => setDraft(e.target.value)} aria-label="Task name" placeholder="Add an intention…" disabled={!ready} maxLength={120}/><div className="editor-row"><label>Priority<select aria-label="Task priority" value={priority} onChange={e => setPriority(e.target.value as typeof priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input aria-label="Task due date" type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div><div className="editor-actions">{editing && <button type="button" onClick={clear}>Cancel</button>}<button type="submit" disabled={!ready || !draft.trim()}><Plus size={14}/>{editing ? 'Save task' : 'Add task'}</button></div></form>
  </section>
}
