import { test } from 'node:test'
import assert from 'node:assert/strict'
const messages:any[]=[], events:Record<string,any>={}, imports:string[]=[]
const data:Record<string,any>={}
const listener=(name:string)=>({addListener:(fn:any)=>{events[name]=fn}})
Object.defineProperty(globalThis,'importScripts',{configurable:true,value:(path:string)=>imports.push(path)})
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{runtime:{id:'test',getURL:(s:string)=>`chrome-extension://test/${s}`,onMessage:{addListener:(fn:any)=>messages.push(fn)},onStartup:listener('startup'),onInstalled:listener('installed')},commands:{onCommand:listener('command')},alarms:{onAlarm:listener('alarm'),getAll:async()=>[],clear:async()=>true,create:async()=>{}},storage:{local:{get:async(k:string)=>({[k]:data[k]}),set:async(v:any)=>Object.assign(data,v)}},windows:{getLastFocused:async()=>({id:1,incognito:false})}}})
await import('../src/automation/worker')
test('worker registers event-driven triggers and retains the existing website handler',()=>{assert.deepEqual(imports,['background.js']);for(const name of ['startup','installed','command','alarm'])assert.equal(typeof events[name],'function');assert.equal(messages.length,1)})
test('worker rejects automation messages from external pages',()=>{let response:any;const result=messages[0]({type:'NOVA_AUTOMATION_CLEAR'},{id:'test',url:'https://example.test/'},(v:any)=>{response=v});assert.equal(result,false);assert.equal(response.ok,false);assert.match(response.error,/Unauthorized/)})
