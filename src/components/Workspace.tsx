import { Notes } from './Notes'
import { Tasks } from './Tasks'
import { Focus } from './Focus'
import type { Widget, WidgetSize, WorkspaceWidget } from '../lib/types'

export function Workspace({ visible, order, sizes }: { visible: Widget[]; order: WorkspaceWidget[]; sizes: Record<WorkspaceWidget, WidgetSize> }) {
  return <section className="workspace" aria-label="Workspace widgets">
    {order.filter(widget => visible.includes(widget)).map(widget => <div className="workspace-cell" data-size={sizes[widget]} key={widget}>{widget === 'notes' ? <Notes/> : widget === 'tasks' ? <Tasks/> : <Focus/>}</div>)}
  </section>
}
