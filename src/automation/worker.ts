import { initialize, saveWorkflow, deleteWorkflow, clearHistory, startWorkflow, control, onAlarm, startup, shortcut } from './engine'
import type { Workflow } from './model'
declare function importScripts(...urls:string[]):void
// Keep Day 5's content-script message handler unchanged.
importScripts('background.js')
chrome.runtime.onMessage.addListener((message:unknown,sender,respond)=>{
  const m=message as {type?:string; workflow?:Workflow; id?:string; sourceTabId?:number; sourceUrl?:string; command?:'pause'|'resume'|'approve'|'cancel'}
  if(!m?.type?.startsWith('NOVA_AUTOMATION_'))return false
  if(sender.tab?.incognito || sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('automations.html'))) { respond({ok:false,error:'Unauthorized automation request.'});return false }
  const task=(async()=>{await initialize();switch(m.type){case 'NOVA_AUTOMATION_SAVE':if(!m.workflow)throw new Error('Missing workflow.');await saveWorkflow(m.workflow);break;case 'NOVA_AUTOMATION_DELETE':if(!m.id)throw new Error('Missing workflow ID.');await deleteWorkflow(m.id);break;case 'NOVA_AUTOMATION_RUN':if(!m.id)throw new Error('Missing workflow ID.');await startWorkflow(m.id,m.sourceTabId,false,m.sourceUrl);break;case 'NOVA_AUTOMATION_CONTROL':if(!m.command||!['pause','resume','approve','cancel'].includes(m.command))throw new Error('Invalid control.');await control(m.command);break;case 'NOVA_AUTOMATION_CLEAR':await clearHistory();break;default:throw new Error('Unknown automation request.')}return {ok:true}})()
  task.then(respond).catch(e=>respond({ok:false,error:e instanceof Error?e.message:'Automation request failed.'}));return true
})
chrome.alarms.onAlarm.addListener(alarm=>{void onAlarm(alarm.name).catch(console.error)})
chrome.runtime.onStartup.addListener(()=>{void startup().catch(console.error)})
chrome.runtime.onInstalled.addListener(()=>{void initialize().catch(console.error)})
chrome.commands.onCommand.addListener(command=>{if(command==='run-workflow')void shortcut().catch(console.error)})
void initialize().catch(console.error)
