import { useRef } from 'react'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import type { DashboardSection, UserPreferences, WorkspaceWidget, WidgetSize } from '../../lib/types'

interface Props { preferences: UserPreferences; update: (change: Partial<UserPreferences>) => void }
const sectionLabels: Record<DashboardSection, string> = { clock: 'Clock & greeting', search: 'Search', shortcuts: 'Quick access', widgets: 'Workspace widgets' }
const widgetLabels: Record<WorkspaceWidget, string> = { notes: 'Notes', tasks: 'Tasks', focus: 'Focus timer' }

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next
}
function OrderList<T extends string>({ label, items, labels, onChange }: { label: string; items: T[]; labels: Record<T, string>; onChange: (order: T[]) => void }) {
  const dragged = useRef<T | null>(null)
  return <div className="studio-order" role="group" aria-label={label}>{items.map((id, i) => <div className="studio-order-row" key={id} draggable onDragStart={event => { dragged.current = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }} onDragEnd={() => { dragged.current = null }} onDragOver={event => { if (dragged.current) event.preventDefault() }} onDrop={event => { event.preventDefault(); if (dragged.current) onChange(reorder(items, items.indexOf(dragged.current), i)); dragged.current = null }}><GripVertical size={15} className="drag-grip" aria-hidden="true"/><span>{labels[id]}</span><button type="button" className="icon-button small" disabled={i === 0} aria-label={`Move ${labels[id]} up`} onClick={() => onChange(reorder(items, i, i - 1))}><ArrowUp size={15}/></button><button type="button" className="icon-button small" disabled={i === items.length - 1} aria-label={`Move ${labels[id]} down`} onClick={() => onChange(reorder(items, i, i + 1))}><ArrowDown size={15}/></button></div>)}</div>
}
export function LayoutStudio({ preferences: p, update }: Props) {
  return <div className="layout-studio"><div className="setting-row"><div><strong>Dashboard alignment</strong><small>Align the main content to the left or center.</small></div><select aria-label="Dashboard alignment" value={p.alignment} onChange={e => update({ alignment: e.target.value as UserPreferences['alignment'] })}><option value="center">Center</option><option value="left">Left</option></select></div>
    <h4 className="subheading">Section order</h4><p className="helper">Drag a row or use the arrow buttons. Search remains available in every layout.</p><OrderList label="Dashboard section order" items={p.sectionOrder} labels={sectionLabels} onChange={sectionOrder => update({ sectionOrder })}/>
    <h4 className="subheading">Widget order</h4><p className="helper">Arrange the workspace; hidden widgets keep their place.</p><OrderList label="Workspace widget order" items={p.widgetOrder} labels={widgetLabels} onChange={widgetOrder => update({ widgetOrder })}/>
    <h4 className="subheading">Widget width</h4>{p.widgetOrder.map(widget => <div className="setting-row" key={widget}><div><strong>{widgetLabels[widget]}</strong><small>Wide spans both workspace columns on larger screens.</small></div><select aria-label={`${widgetLabels[widget]} width`} value={p.widgetSizes[widget]} onChange={e => update({ widgetSizes: { ...p.widgetSizes, [widget]: e.target.value as WidgetSize } })}><option value="normal">Normal</option><option value="wide">Wide</option></select></div>)}
  </div>
}
