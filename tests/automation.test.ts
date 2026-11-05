import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { ACTIONS, newAction, newWorkflow, nextSchedule, validateWorkflow } from '../src/automation/model'
import type { Workflow, ActionType } from '../src/automation/model'
import { executeAction } from '../src/automation/actions'
const db:Record<string,any>={}, alarms=new Map<string,any>(), opened:string[]=[], notifications:any[]=[]
let source={id:4,windowId:1,incognito:false,url:'https://example.test/article',title:'Source'}, notificationPermission=false
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{
 storage:{local:{get:async(k:string|string[])=>Object.fromEntries((Array.isArray(k)?k:[k]).map(key=>[key,structuredClone(db[key])])),set:async(v:any)=>Object.assign(db,structuredClone(v))}},
 windows:{getLastFocused:async()=>({id:1,incognito:false}),getCurrent:async()=>({id:1,incognito:false})},
 tabs:{create:async(o:any)=>{opened.push(o.url);return {id:99,...o}},query:async()=>[],get:async()=>structuredClone(source)},
 alarms:{create:async(name:string,options:any)=>{alarms.set(name,options)},clear:async(name:string)=>alarms.delete(name),getAll:async()=>[...alarms].map(([name,value])=>({name,...value}))},
 permissions:{contains:async()=>notificationPermission},notifications:{create:async(o:any)=>{notifications.push(o);return 'notification'}},runtime:{getURL:(s:string)=>`chrome-extension://test/${s}`},tabGroups:{update:async()=>{}},
}})
const engine=await import('../src/automation/engine')
const step=(type:ActionType,config:Record<string,string|number>={})=>{const a=newAction(type);return {...a,config:{...a.config,...config}}}
const workflow=(name:string,actions:ReturnType<typeof step>[],trigger:Workflow['trigger']={type:'manual'}):Workflow=>({...newWorkflow(),name,actions,trigger,enabled:trigger.type!=='manual'})
const waitFor=async(predicate:()=>boolean)=>{const deadline=Date.now()+2000;while(!predicate()){if(Date.now()>deadline)throw new Error('Timed out waiting for automation state');await new Promise(resolve=>setTimeout(resolve,5))}}

test('validator rejects unsafe URLs, invalid configuration, malformed actions and unsafe automatic page saves',()=>{
 const w=workflow('Example',[step('openUrl',{url:'javascript:alert(1)'})]);assert.match(validateWorkflow(w).join(' '),/HTTP/)
 w.actions=[step('focus',{minutes:0})];assert.match(validateWorkflow(w).join(' '),/1–180/)
 w.actions=[null as any];assert.match(validateWorkflow(w).join(' '),/Invalid action/)
 w.actions=[step('savePage')];w.trigger={type:'startup'};assert.match(validateWorkflow(w).join(' '),/only for manual/)
 assert.equal(nextSchedule('09:30',new Date(2025,0,1,10,0)),new Date(2025,0,2,9,30).getTime());assert.throws(()=>nextSchedule('25:00'))
})
test('sequential execution persists progress, waits, pauses, asks approval and records history',async()=>{
 const w=workflow('Morning',[step('openUrl',{url:'https://example.test/'}),step('wait',{seconds:60}),step('confirm',{message:'Continue?'}),step('note',{title:'Ideas',content:'hello'})]);await engine.saveWorkflow(w);await engine.startWorkflow(w.id)
 await waitFor(()=>db['nova:automations:active']?.status==='waiting');assert.deepEqual(opened,['https://example.test/']);assert.equal(db['nova:automations:active'].completed,1)
 await assert.rejects(engine.startWorkflow(w.id),/already running/);await engine.control('pause');assert.equal(db['nova:automations:active'].status,'paused');await engine.control('resume');assert.equal(db['nova:automations:active'].status,'waiting')
 db['nova:automations:active'].waitUntil=Date.now()-1;await engine.onAlarm('nova-workflow-wait');await waitFor(()=>db['nova:automations:active']?.status==='confirmation');assert.equal(db.notes,undefined)
 await engine.control('approve');await waitFor(()=>!db['nova:automations:active']);assert.equal(db.notes[0].title,'Ideas');assert.equal(db['nova:automations:history'][0].status,'success');assert.equal(db['nova:automations:history'][0].completed,4)
})
test('action failures stop subsequent steps and cancellation is recorded',async()=>{
 const w=workflow('Failure',[step('session',{sessionId:'missing'}),step('openUrl',{url:'https://never.test/'})]);await engine.saveWorkflow(w);await engine.startWorkflow(w.id);await waitFor(()=>!db['nova:automations:active']);assert.equal(db['nova:automations:history'][0].status,'failed');assert.match(db['nova:automations:history'][0].error,/no longer exists/);assert.ok(!opened.includes('https://never.test/'))
 const wait=workflow('Cancel',[step('wait',{seconds:30})]);await engine.saveWorkflow(wait);await engine.startWorkflow(wait.id);await waitFor(()=>db['nova:automations:active']?.status==='waiting');await engine.control('cancel');assert.equal(db['nova:automations:history'][0].status,'cancelled');assert.equal(alarms.has('nova-workflow-wait'),false)
})
test('startup, schedule and shortcut are opt-in; conflicting automatic triggers are recorded',async()=>{
 const scheduled=workflow('Daily',[step('note',{title:'Daily',content:''})],{type:'scheduled',time:'09:00'});await engine.saveWorkflow(scheduled);assert.ok(alarms.has('nova-workflow:'+scheduled.id));await engine.onAlarm('nova-workflow:'+scheduled.id);await waitFor(()=>!db['nova:automations:active']);assert.equal(db.notes[0].title,'Daily')
 const startup=workflow('Startup',[step('wait',{seconds:30})],{type:'startup'}),second=workflow('Startup two',[step('note',{title:'Should not run',content:''})],{type:'startup'});await engine.saveWorkflow(startup);await engine.saveWorkflow(second);await engine.startup();assert.ok(alarms.has('nova-workflow-startup:'+startup.id));await engine.onAlarm('nova-workflow-startup:'+startup.id);await waitFor(()=>db['nova:automations:active']?.status==='waiting');await engine.onAlarm('nova-workflow-startup:'+second.id);assert.ok(db['nova:automations:history'].some((x:any)=>x.workflowName==='Startup two'&&x.status==='failed'));await engine.control('cancel')
 const key=workflow('Shortcut',[step('note',{title:'Shortcut',content:''})],{type:'shortcut'});await engine.saveWorkflow(key);const other=workflow('Other shortcut',[step('wait',{seconds:5})],{type:'shortcut'});await assert.rejects(engine.saveWorkflow(other),/Only one shortcut/);await engine.shortcut();await waitFor(()=>!db['nova:automations:active']);assert.equal(db.notes[0].title,'Shortcut')
})
test('actions reuse NOVA storage, saved sessions, Research and optional notifications',async()=>{
 const dummy={sourceTabId:4,sourceUrl:source.url} as any
 await executeAction(step('theme',{theme:'dawn'}),dummy);await executeAction(step('layout',{layout:'workspace'}),dummy);assert.equal(db.preferences.theme,'dawn');assert.equal(db.preferences.layout,'workspace')
 await executeAction(step('focus',{minutes:30}),dummy);assert.equal(db.focusState.durations.focus,30);assert.ok(db.focusState.endsAt>Date.now())
 db['nova:savedSessions']=[{id:'session',name:'Saved',createdAt:1,updatedAt:1,tabs:[{url:'https://saved.test/',title:'Saved'}]}];await executeAction(step('session',{sessionId:'session'}),dummy);assert.ok(opened.includes('https://saved.test/'))
 await executeAction(step('savePage'),dummy);const {getPages,getCollections}=await import('../src/research/db');assert.equal((await getPages()).length,1);await executeAction(step('savePage'),dummy);assert.equal((await getPages()).length,1)
 source.url='https://changed.test/';await assert.rejects(executeAction(step('savePage'),dummy),/changed/);source.url=dummy.sourceUrl
 await executeAction(step('collection',{name:'Research'}),dummy);await executeAction(step('collection',{name:'Research'}),dummy);assert.equal((await getCollections()).length,1);await executeAction(step('researchHub'),dummy);assert.ok(opened.includes('chrome-extension://test/research.html'))
 await assert.rejects(executeAction(step('notification',{message:'Done'}),dummy),/permission/);notificationPermission=true;await executeAction(step('notification',{message:'Done'}),dummy);assert.equal(notifications[0].message,'Done')
})
test('worker restart marks an interrupted in-flight action failed without replaying it',async()=>{
 const w=workflow('Interrupted',[step('openUrl',{url:'https://not-replayed.test/'})]);db['nova:automations:active']={id:'interrupted',workflowId:w.id,workflowName:w.name,workflow:w,status:'running',index:0,completed:0,startedAt:Date.now(),owner:'old-worker'}
 const restarted=await import('../src/automation/engine?restart=1');await restarted.initialize();assert.equal(db['nova:automations:active'],null);assert.match(db['nova:automations:history'][0].error,/effects are unknown/);assert.ok(!opened.includes('https://not-replayed.test/'))
})
test('all actions have visible metadata',()=>{for(const action of Object.values(ACTIONS)){assert.ok(action.name);assert.ok(action.description);assert.ok(Array.isArray(action.fields))}})

test('large workspace restores require approval on the preceding action',async()=>{
 const tabs=Array.from({length:11},(_,i)=>({url:`https://large${i}.test/`,title:`Tab ${i}`}));db['nova:savedSessions']=[{id:'large',name:'Large',createdAt:1,updatedAt:1,tabs}]
 const restore=step('session',{sessionId:'large'});await assert.rejects(executeAction(restore,{} as any),/confirmation step/);await executeAction(restore,{approvedForNext:true} as any);assert.ok(opened.includes('https://large0.test/'))
})
test('manual save-page run requires a reviewed matching source',async()=>{
 const w=workflow('Save page',[step('savePage')]);await engine.saveWorkflow(w);await assert.rejects(engine.startWorkflow(w.id),/toolbar/);await assert.rejects(engine.startWorkflow(w.id,4,false,'https://old.test/'),/changed/);await engine.startWorkflow(w.id,4,false,source.url);await waitFor(()=>!db['nova:automations:active']);assert.equal(db['nova:automations:history'][0].status,'success')
})
test('disabled startup and schedules do not run; deleting clears the alarm',async()=>{
 const disabled={...workflow('Disabled',[step('note',{title:'Never',content:''})],{type:'scheduled',time:'10:30'}),enabled:false};await engine.saveWorkflow(disabled);assert.equal(alarms.has('nova-workflow:'+disabled.id),false)
 const enabled={...disabled,enabled:true};await engine.saveWorkflow(enabled);assert.equal(alarms.has('nova-workflow:'+enabled.id),true);await engine.deleteWorkflow(enabled.id);assert.equal(alarms.has('nova-workflow:'+enabled.id),false)
})


test('explicit approval enables a large session only after the confirmation step',async()=>{
 const w=workflow('Large session',[step('confirm',{message:'Open a large workspace?'}),step('session',{sessionId:'large'})]);await engine.saveWorkflow(w);const before=opened.length;await engine.startWorkflow(w.id);await waitFor(()=>db['nova:automations:active']?.status==='confirmation');assert.equal(opened.length,before);await engine.control('approve');await waitFor(()=>!db['nova:automations:active']);assert.equal(db['nova:automations:history'][0].status,'success');assert.equal(opened.length,before+11)
})

test('worker restart restores a durable wait without replaying earlier actions',async()=>{
 const w=workflow('Wait recovery',[step('wait',{seconds:60}),step('note',{title:'Recovered',content:''})]);const before=opened.length
 db['nova:automations:active']={id:'wait-recovery',workflowId:w.id,workflowName:w.name,workflow:w,status:'waiting',index:0,completed:0,startedAt:Date.now(),owner:'old-worker',waitUntil:Date.now()+60000}
 alarms.delete('nova-workflow-wait');const restarted=await import('../src/automation/engine?restart=2');await restarted.initialize();assert.ok(alarms.has('nova-workflow-wait'));assert.equal(db['nova:automations:active'].status,'waiting');db['nova:automations:active'].waitUntil=Date.now()-1;await restarted.onAlarm('nova-workflow-wait');await waitFor(()=>!db['nova:automations:active']);assert.equal(db.notes[0].title,'Recovered');assert.equal(opened.length,before)
})
test('a timeout while awaiting confirmation fails safely without executing the next action',async()=>{
 const w=workflow('Timeout',[step('confirm'),step('openUrl',{url:'https://timeout-never.test/'})]);await engine.saveWorkflow(w);await engine.startWorkflow(w.id);await waitFor(()=>db['nova:automations:active']?.status==='confirmation');db['nova:automations:active'].startedAt=Date.now()-700000;await engine.onAlarm('nova-workflow-wait');assert.equal(db['nova:automations:history'][0].status,'failed');assert.match(db['nova:automations:history'][0].error,/timed out/);assert.ok(!opened.includes('https://timeout-never.test/'))
})

test('invalid preference storage is not overwritten by an automation',async()=>{
 const original=db.preferences;db.preferences='malformed';await assert.rejects(executeAction(step('theme',{theme:'dawn'}),{} as any),/existing data was not changed/);assert.equal(db.preferences,'malformed');db.preferences=original
})
test('execution history is bounded to 100 entries',async()=>{
 db['nova:automations:history']=Array.from({length:110},(_,i)=>({id:`old-${i}`,workflowId:'old',workflowName:'Old',status:'success',startedAt:1,endedAt:2,completed:1,total:1}));const w=workflow('Bounded',[step('note',{title:'One more',content:''})]);await engine.saveWorkflow(w);await engine.startWorkflow(w.id);await waitFor(()=>!db['nova:automations:active']);assert.equal(db['nova:automations:history'].length,100);assert.equal(db['nova:automations:history'][0].workflowName,'Bounded')
})
