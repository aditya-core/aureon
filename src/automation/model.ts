import { safeUrl } from '../command/model'

export type ActionType = 'openUrl' | 'session' | 'theme' | 'layout' | 'focus' | 'note' | 'savePage' | 'notification' | 'wait' | 'confirm' | 'collection' | 'researchHub'
export interface WorkflowAction { id: string; type: ActionType; enabled: boolean; config: Record<string, string | number> }
export interface Workflow { id: string; name: string; description: string; enabled: boolean; trigger: { type: 'manual' | 'startup' | 'scheduled' | 'shortcut'; time?: string }; actions: WorkflowAction[]; timeoutSeconds: number; createdAt: number; updatedAt: number }
export type RunStatus = 'running' | 'waiting' | 'confirmation' | 'paused' | 'success' | 'failed' | 'cancelled'
export interface Execution { id: string; workflowId: string; workflowName: string; workflow: Workflow; status: RunStatus; index: number; completed: number; startedAt: number; endedAt?: number; error?: string; failedAction?: string; owner: string; sourceTabId?: number; sourceUrl?: string; waitUntil?: number; waitRemaining?: number; pauseRequested?: boolean; approvedForNext?: boolean }
export interface Field { key: string; label: string; kind: 'text' | 'number' | 'select' | 'textarea'; options?: string[]; placeholder?: string }
export interface Definition { name: string; description: string; fields: Field[]; defaults: Record<string, string | number> }
export const ACTIONS: Record<ActionType, Definition> = {
  openUrl: { name:'Open website', description:'Open a safe HTTP or HTTPS address in a new tab.', fields:[{key:'url',label:'Website URL',kind:'text',placeholder:'https://example.com'}], defaults:{url:''} },
  session: { name:'Restore saved session', description:'Restore a Command Centre workspace, skipping already-open URLs.', fields:[{key:'sessionId',label:'Saved workspace ID',kind:'text'}], defaults:{sessionId:''} },
  theme: { name:'Apply theme', description:'Change the existing NOVA theme.', fields:[{key:'theme',label:'Theme',kind:'select',options:['midnight','dawn','aurora','custom']}], defaults:{theme:'midnight'} },
  layout: { name:'Apply layout', description:'Switch the existing NOVA dashboard layout.', fields:[{key:'layout',label:'Layout',kind:'select',options:['focus','workspace','immersive']}], defaults:{layout:'focus'} },
  focus: { name:'Start focus timer', description:'Start the existing focus timer for the chosen duration.', fields:[{key:'minutes',label:'Minutes (1–180)',kind:'number'}], defaults:{minutes:25} },
  note: { name:'Create note', description:'Create a local NOVA note.', fields:[{key:'title',label:'Title',kind:'text'},{key:'content',label:'Content',kind:'textarea'}], defaults:{title:'',content:''} },
  savePage: { name:'Save source page', description:'Save the explicitly selected source page to Research. Manual runs only.', fields:[], defaults:{} },
  notification: { name:'Show notification', description:'Display a browser notification after permission is granted.', fields:[{key:'message',label:'Notification message',kind:'text'}], defaults:{message:'Your NOVA workflow is complete.'} },
  wait: { name:'Wait', description:'Pause before the next action using a browser alarm.', fields:[{key:'seconds',label:'Seconds (1–3600)',kind:'number'}], defaults:{seconds:60} },
  collection: { name:'Create Research collection', description:'Create a local collection unless one with that name already exists.', fields:[{key:'name',label:'Collection name',kind:'text'}], defaults:{name:'Research Sprint'} },
  researchHub: { name:'Open Research workspace', description:'Open NOVA’s existing Research workspace.', fields:[], defaults:{} },
  confirm: { name:'Ask for confirmation', description:'Pause until you approve or cancel in Automations.', fields:[{key:'message',label:'Question',kind:'text'}], defaults:{message:'Continue this workflow?'} },
}
export const actionTypes = Object.keys(ACTIONS) as ActionType[]
const isText = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || !!v.trim())
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
export function validateAction(a: WorkflowAction): string | null {
  if (!a || !isText(a.id,80,true) || !actionTypes.includes(a.type) || typeof a.enabled !== 'boolean' || !a.config || typeof a.config !== 'object' || Array.isArray(a.config)) return 'Invalid action.'
  const c = a.config
  switch(a.type) {
    case 'openUrl': return safeUrl(c.url) ? null : 'Enter a valid HTTP(S) URL without credentials.'
    case 'session': return isText(c.sessionId,80,true) ? null : 'Choose a saved workspace.'
    case 'theme': return ['midnight','dawn','aurora','custom'].includes(String(c.theme)) ? null : 'Choose a valid theme.'
    case 'layout': return ['focus','workspace','immersive'].includes(String(c.layout)) ? null : 'Choose a valid layout.'
    case 'focus': return integer(c.minutes,1,180) ? null : 'Focus duration must be 1–180 minutes.'
    case 'note': return isText(c.title,100,true) && isText(c.content,20000) ? null : 'Enter a note title (up to 100 characters) and content (up to 20,000).'
    case 'notification': case 'confirm': return isText(c.message,200,true) ? null : 'Enter a message up to 200 characters.'
    case 'wait': return integer(c.seconds,1,3600) ? null : 'Wait must be 1–3,600 seconds.'
    case 'collection': return isText(c.name,80,true) ? null : 'Enter a collection name up to 80 characters.'
    case 'savePage': case 'researchHub': return null
  }
}
export function validateWorkflow(w: Workflow): string[] {
  if (!w || typeof w !== 'object') return ['Invalid workflow.']
  const errors: string[] = []
  if (!isText(w.id,80,true) || !isText(w.name,80,true) || !isText(w.description,500) || typeof w.enabled !== 'boolean') errors.push('Enter a workflow name up to 80 characters and description up to 500 characters.')
  if (!w.trigger || !['manual','startup','scheduled','shortcut'].includes(w.trigger.type)) errors.push('Choose a valid trigger.')
  else if (w.trigger.type === 'scheduled' && (typeof w.trigger.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.trigger.time))) errors.push('Choose a valid schedule time.')
  if (!integer(w.timeoutSeconds, 30, 7200)) errors.push('Workflow timeout must be 30–7,200 seconds.')
  if (!Array.isArray(w.actions) || !w.actions.length || w.actions.length > 30) return [...errors,'Add between 1 and 30 actions.']
  const ids = new Set<string>()
  w.actions.forEach((a,i)=>{const error=validateAction(a);if(error) errors.push(`Step ${i+1}: ${error}`);if(a && typeof a.id==='string'){if(ids.has(a.id))errors.push(`Step ${i+1}: duplicate action ID.`);ids.add(a.id)}})
  if (!w.actions.some(a=>a?.enabled)) errors.push('Enable at least one action.')
  if (w.trigger?.type !== 'manual' && w.actions.some(a=>a?.enabled && a.type==='savePage')) errors.push('Save source page is available only for manual workflows.')
  if (typeof w.createdAt !== 'number' || !Number.isFinite(w.createdAt) || typeof w.updatedAt !== 'number' || !Number.isFinite(w.updatedAt)) errors.push('Invalid workflow timestamps.')
  return errors
}
export const newAction = (type: ActionType): WorkflowAction => ({id:crypto.randomUUID(),type,enabled:true,config:{...ACTIONS[type].defaults}})
export const newWorkflow = (): Workflow => ({id:crypto.randomUUID(),name:'',description:'',enabled:false,trigger:{type:'manual'},actions:[newAction('openUrl')],timeoutSeconds:600,createdAt:Date.now(),updatedAt:Date.now()})
export function nextSchedule(time: string, now = new Date()): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid schedule time.')
  const [h,m]=time.split(':').map(Number), next=new Date(now);next.setHours(h,m,0,0);if(next.getTime()<=now.getTime())next.setDate(next.getDate()+1);return next.getTime()
}
