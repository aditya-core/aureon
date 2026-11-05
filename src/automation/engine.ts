import { ACTIONS, nextSchedule, validateWorkflow } from './model'
import type { Execution, Workflow } from './model'
import { executeAction } from './actions'
import { supportedPage } from '../ai/context'

const WORKFLOWS='nova:automations:workflows', ACTIVE='nova:automations:active', HISTORY='nova:automations:history'
const SCHEDULE='nova-workflow:', STARTUP='nova-workflow-startup:', WAKE='nova-workflow-wait'
const owner=crypto.randomUUID()
let queue: Promise<unknown> = Promise.resolve(), initializing: Promise<void> | undefined, inFlight=false, pendingAdvance:string|undefined
function exclusive<T>(fn:()=>Promise<T>):Promise<T>{const next=queue.catch(()=>{}).then(fn);queue=next;return next}
export interface HistoryEntry { id:string; workflowId:string; workflowName:string; status:'success'|'failed'|'cancelled'; startedAt:number; endedAt:number; completed:number; total:number; failedAction?:string; error?:string }
export async function workflows():Promise<Workflow[]> { const data=(await chrome.storage.local.get(WORKFLOWS))[WORKFLOWS];if(data===undefined)return [];if(!Array.isArray(data)||data.length>50||data.some(w=>validateWorkflow(w as Workflow).length))throw new Error('Workflow data is invalid. Existing data was not changed.');return data as Workflow[] }
export async function active():Promise<Execution|null>{return (await chrome.storage.local.get(ACTIVE))[ACTIVE] as Execution|null || null}
async function appendHistory(run:Execution,status:HistoryEntry['status'],error?:string) { const raw=(await chrome.storage.local.get(HISTORY))[HISTORY];if(raw!==undefined&&!Array.isArray(raw))throw new Error('Execution history is invalid. Existing data was not changed.');const history=(raw||[]) as HistoryEntry[];const entry:HistoryEntry={id:run.id,workflowId:run.workflowId,workflowName:run.workflowName,status,startedAt:run.startedAt,endedAt:Date.now(),completed:run.completed,total:run.workflow.actions.filter(a=>a.enabled).length,...(error?{error:error.slice(0,400),failedAction:run.workflow.actions[run.index] ? ACTIONS[run.workflow.actions[run.index].type].name : undefined}:{})};await chrome.storage.local.set({[HISTORY]:[entry,...history].slice(0,100),[ACTIVE]:null}) }
async function finish(id:string,status:HistoryEntry['status'],error?:string){await exclusive(async()=>{const run=await active();if(!run||run.id!==id)return;await appendHistory(run,status,error)});await chrome.alarms.clear(WAKE)}
async function scheduleOne(w:Workflow){const name=SCHEDULE+w.id;await chrome.alarms.clear(name);if(!w.enabled||w.trigger.type!=='startup')await chrome.alarms.clear(STARTUP+w.id);if(w.enabled&&w.trigger.type==='scheduled')await chrome.alarms.create(name,{when:nextSchedule(w.trigger.time!)})}
export async function saveWorkflow(w:Workflow):Promise<void>{const errors=validateWorkflow(w);if(errors.length)throw new Error(errors.join(' '));await exclusive(async()=>{const list=await workflows(),i=list.findIndex(x=>x.id===w.id);if(i<0&&list.length>=50)throw new Error('You can save up to 50 workflows.');if(w.enabled&&w.trigger.type==='shortcut'&&list.some(x=>x.id!==w.id&&x.enabled&&x.trigger.type==='shortcut'))throw new Error('Only one shortcut workflow can be enabled at a time.');const next={...w,updatedAt:Date.now()};if(i<0)list.push(next);else list[i]=next;await chrome.storage.local.set({[WORKFLOWS]:list});await scheduleOne(next)})}
export async function deleteWorkflow(id:string):Promise<void>{await exclusive(async()=>{const list=await workflows();await chrome.storage.local.set({[WORKFLOWS]:list.filter(w=>w.id!==id)});await chrome.alarms.clear(SCHEDULE+id);await chrome.alarms.clear(STARTUP+id)})}
export async function clearHistory():Promise<void>{await exclusive(async()=>{await chrome.storage.local.set({[HISTORY]:[]})})}
/** Recover conservatively: never replay an action whose side effect may already have occurred. */
export function initialize():Promise<void>{if(initializing)return initializing;initializing=(async()=>{
  const run=await active()
  if(run?.status==='running' && run.owner!==owner)await finish(run.id,'failed','Browser worker stopped during an action. Its effects are unknown; review them before retrying.')
  else if(run&&['waiting','paused','confirmation'].includes(run.status)){const deadline=run.startedAt+run.workflow.timeoutSeconds*1000;await chrome.alarms.create(WAKE,{when:Math.max(Date.now()+1000,Math.min(run.waitUntil||deadline,deadline))})}
  const list=await workflows(), valid=new Set(list.filter(w=>w.enabled&&w.trigger.type==='scheduled').map(w=>SCHEDULE+w.id))
  const alarms=await chrome.alarms.getAll();for(const a of alarms)if(a.name.startsWith(SCHEDULE)&&!valid.has(a.name))await chrome.alarms.clear(a.name);else if(a.name.startsWith(STARTUP)&&!list.some(w=>w.enabled&&w.trigger.type==='startup'&&STARTUP+w.id===a.name))await chrome.alarms.clear(a.name)
  for(const w of list)if(valid.has(SCHEDULE+w.id)&&!alarms.some(a=>a.name===SCHEDULE+w.id))await scheduleOne(w)
})().catch(e=>{initializing=undefined;throw e});return initializing}
export async function startWorkflow(id:string, sourceTabId?:number, automatic=false, expectedSourceUrl?:string):Promise<void>{
  await initialize();let started:Execution|undefined
  await exclusive(async()=>{const list=await workflows(),w=list.find(x=>x.id===id);if(!w)throw new Error('Workflow not found.');if(automatic&&!w.enabled)throw new Error('Workflow is disabled.');if(await active()||inFlight)throw new Error('Another workflow is already running or paused.');const currentWindow=await chrome.windows.getLastFocused();if(currentWindow.incognito||currentWindow.id===undefined)throw new Error('Open a normal browser window to run workflows.');let sourceUrl:string|undefined
    if(w.actions.some(a=>a.enabled&&a.type==='savePage')){if(automatic||sourceTabId===undefined)throw new Error('Open Automations from the NOVA toolbar on the page you want to save.');const tab=await chrome.tabs.get(sourceTabId);if(!tab.url||supportedPage(tab))throw new Error('The source page is unavailable, private, or unsupported.');if(!expectedSourceUrl||expectedSourceUrl!==tab.url)throw new Error('The source page changed. Review it before running again.');sourceUrl=tab.url}
    started={id:crypto.randomUUID(),workflowId:w.id,workflowName:w.name,workflow:w,status:'running',index:0,completed:0,startedAt:Date.now(),owner,...(sourceTabId!==undefined?{sourceTabId}:{}),...(sourceUrl?{sourceUrl}:{})};await chrome.storage.local.set({[ACTIVE]:started})})
  if(started)requestAdvance(started.id)
}
async function timed<T>(promise:Promise<T>, timeoutMs:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Action timed out. It may still have completed; review before retrying.')),Math.max(1,Math.min(25000,timeoutMs)))})])}finally{if(timer)clearTimeout(timer)}}
function requestAdvance(id:string){if(inFlight){pendingAdvance=id;return}void advance(id)}
async function advance(id:string):Promise<void>{if(inFlight){pendingAdvance=id;return}inFlight=true
  try{while(true){const run=await active();if(!run||run.id!==id||run.status!=='running')return
    if(Date.now()-run.startedAt>run.workflow.timeoutSeconds*1000){await finish(id,'failed','Workflow timed out. Review completed actions before retrying.');return}
    if(run.pauseRequested){await exclusive(async()=>{const current=await active();if(current?.id===id&&current.status==='running'){await chrome.storage.local.set({[ACTIVE]:{...current,status:'paused',pauseRequested:false}});await chrome.alarms.create(WAKE,{when:current.startedAt+current.workflow.timeoutSeconds*1000})}});return}
    const step=run.workflow.actions[run.index];if(!step){await finish(id,'success');return}
    if(!step.enabled){await exclusive(async()=>{const current=await active();if(current?.id===id&&current.status==='running')await chrome.storage.local.set({[ACTIVE]:{...current,index:current.index+1}})});continue}
    if(step.type==='wait'||step.type==='confirm'){
      const until=Date.now()+(step.config.seconds as number)*1000
      await exclusive(async()=>{const current=await active();if(current?.id!==id||current.status!=='running')return;const next:Execution=step.type==='wait'?{...current,status:'waiting',waitUntil:until}:{...current,status:'confirmation'};await chrome.storage.local.set({[ACTIVE]:next});await chrome.alarms.create(WAKE,{when:step.type==='wait'?Math.min(until,current.startedAt+current.workflow.timeoutSeconds*1000):current.startedAt+current.workflow.timeoutSeconds*1000})});return
    }
    try{await timed(executeAction(step,run),run.startedAt+run.workflow.timeoutSeconds*1000-Date.now())}catch(e){await finish(id,'failed',e instanceof Error?e.message:'Action failed.');return}
    await exclusive(async()=>{const current=await active();if(current?.id===id&&current.status==='running')await chrome.storage.local.set({[ACTIVE]:{...current,index:current.index+1,completed:current.completed+1,approvedForNext:false}})})
  }}catch(e){await finish(id,'failed',e instanceof Error?e.message:'Execution failed.')}finally{inFlight=false;if(pendingAdvance){const next=pendingAdvance;pendingAdvance=undefined;requestAdvance(next)}}
}
export async function control(command:'pause'|'resume'|'approve'|'cancel'):Promise<void>{await initialize();let resumeId:string|undefined
  await exclusive(async()=>{const run=await active();if(!run)throw new Error('There is no active workflow.')
    if(command==='cancel'){await appendHistory(run,'cancelled','Cancelled by user. An action already in progress may still complete.');await chrome.alarms.clear(WAKE);return}
    if(command==='pause'){
      if(run.status==='running'){await chrome.storage.local.set({[ACTIVE]:{...run,pauseRequested:true}});return}
      if(run.status==='waiting'){await chrome.alarms.create(WAKE,{when:run.startedAt+run.workflow.timeoutSeconds*1000});await chrome.storage.local.set({[ACTIVE]:{...run,status:'paused',waitRemaining:Math.max(0,(run.waitUntil||Date.now())-Date.now()),waitUntil:undefined}});return}
      throw new Error('This workflow cannot be paused at this step.')
    }
    if(command==='approve'){if(run.status!=='confirmation')throw new Error('No confirmation is pending.');await chrome.alarms.clear(WAKE);await chrome.storage.local.set({[ACTIVE]:{...run,status:'running',index:run.index+1,completed:run.completed+1,owner,approvedForNext:true}});resumeId=run.id;return}
    if(run.status!=='paused')throw new Error('Workflow is not paused.')
    if(run.waitRemaining!==undefined){const until=Date.now()+run.waitRemaining;await chrome.storage.local.set({[ACTIVE]:{...run,status:'waiting',waitRemaining:undefined,waitUntil:until,owner}});await chrome.alarms.create(WAKE,{when:Math.min(until,run.startedAt+run.workflow.timeoutSeconds*1000)});return}
    await chrome.storage.local.set({[ACTIVE]:{...run,status:'running',owner}});resumeId=run.id
  });if(resumeId)requestAdvance(resumeId)
}
async function recordTriggerFailure(w:Workflow,error:unknown){await exclusive(async()=>{const raw=(await chrome.storage.local.get(HISTORY))[HISTORY];if(raw!==undefined&&!Array.isArray(raw))throw new Error('Execution history is invalid.');const now=Date.now();const entry:HistoryEntry={id:crypto.randomUUID(),workflowId:w.id,workflowName:w.name,status:'failed',startedAt:now,endedAt:now,completed:0,total:w.actions.filter(a=>a.enabled).length,error:error instanceof Error?error.message:'Automatic workflow could not start.'};await chrome.storage.local.set({[HISTORY]:[entry,...(raw||[])].slice(0,100)})})}
export async function onAlarm(name:string){await initialize();if(name===WAKE){const existing=await active();if(existing&&Date.now()-existing.startedAt>=existing.workflow.timeoutSeconds*1000){await finish(existing.id,'failed','Workflow timed out while waiting. Review completed actions before retrying.');return}let resumeId:string|undefined;await exclusive(async()=>{const run=await active();if(!run||run.status!=='waiting')return;if((run.waitUntil||0)>Date.now() && Date.now()-run.startedAt<run.workflow.timeoutSeconds*1000){await chrome.alarms.create(WAKE,{when:Math.min(run.waitUntil!,run.startedAt+run.workflow.timeoutSeconds*1000)});return}await chrome.storage.local.set({[ACTIVE]:{...run,status:'running',waitUntil:undefined,index:run.index+1,completed:run.completed+1,owner,approvedForNext:false}});resumeId=run.id});if(resumeId)requestAdvance(resumeId);return}
  if(name.startsWith(STARTUP)){const w=(await workflows()).find(x=>STARTUP+x.id===name);if(w?.enabled&&w.trigger.type==='startup')try{await startWorkflow(w.id,undefined,true)}catch(e){await recordTriggerFailure(w,e)};return}
  if(name.startsWith(SCHEDULE)){const w=(await workflows()).find(x=>SCHEDULE+x.id===name);if(w?.enabled&&w.trigger.type==='scheduled'){await scheduleOne(w);try{await startWorkflow(w.id,undefined,true)}catch(e){await recordTriggerFailure(w,e)}}}
}
// Defer startup actions to give Chrome time to open a normal window; alarms survive worker suspension.
export async function startup(){await initialize();for(const w of await workflows())if(w.enabled&&w.trigger.type==='startup')await chrome.alarms.create(STARTUP+w.id,{delayInMinutes:0.5})}
export async function shortcut(){await initialize();const list=(await workflows()).filter(w=>w.enabled&&w.trigger.type==='shortcut');if(list.length!==1)throw new Error('Enable exactly one shortcut workflow in Automations.');try{await startWorkflow(list[0].id,undefined,true)}catch(e){await recordTriggerFailure(list[0],e);throw e}}
