import { test,afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'chrome-extension://test/automations.html?tab=5',pretendToBeVisual:true})
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,location:dom.window.location,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
Object.defineProperty(dom.window,'confirm',{value:()=>true,configurable:true})
const data:Record<string,any>={}, calls:any[]=[], listeners=new Set<any>()
const source={id:5,url:'https://example.test/article',title:'Source',windowId:1,incognito:false}
const event={addListener:()=>{},removeListener:()=>{}}
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{runtime:{id:'test',sendMessage:async(m:any)=>{calls.push(m);if(m.type==='NOVA_AUTOMATION_SAVE'){const list=data['nova:automations:workflows']||[],i=list.findIndex((w:any)=>w.id===m.workflow.id);if(i<0)list.push(m.workflow);else list[i]=m.workflow;data['nova:automations:workflows']=list}if(m.type==='NOVA_AUTOMATION_DELETE')data['nova:automations:workflows']=(data['nova:automations:workflows']||[]).filter((w:any)=>w.id!==m.id);for(const fn of [...listeners])fn({'nova:automations:workflows':{}},'local');return {ok:true}}},storage:{local:{get:async(k:string|string[])=>Object.fromEntries((Array.isArray(k)?k:[k]).map(x=>[x,data[x]]))},onChanged:{addListener:(fn:any)=>listeners.add(fn),removeListener:(fn:any)=>listeners.delete(fn)}},windows:{getCurrent:async()=>({id:1,incognito:false})},tabs:{get:async()=>source,onUpdated:event,onRemoved:event},permissions:{request:async()=>true}}})
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react')
const {Dashboard}=await import('../src/automation/Dashboard')
afterEach(()=>{cleanup();listeners.clear();calls.length=0;for(const key of Object.keys(data))delete data[key]})
test('dashboard creates, runs, duplicates and deletes a workflow through the worker',async()=>{
 const ui=render(createElement(Dashboard));await ui.findByText(/Source for manual save-page/);fireEvent.click(ui.getByRole('button',{name:'Create workflow'}));await ui.findByLabelText('Workflow editor')
 fireEvent.change(ui.getByLabelText('Name'),{target:{value:'Morning'}});fireEvent.change(ui.getByLabelText('Website URL'),{target:{value:'https://example.test/'}});fireEvent.click(ui.getByRole('button',{name:'Save workflow'}));await ui.findByText('Morning')
 fireEvent.click(ui.getByRole('button',{name:'Run'}));await waitFor(()=>assert.ok(calls.some(c=>c.type==='NOVA_AUTOMATION_RUN'&&c.sourceTabId===5&&c.sourceUrl===source.url)))
 fireEvent.click(ui.getByRole('button',{name:'Duplicate Morning'}));await ui.findByDisplayValue('Morning copy');fireEvent.click(ui.getByRole('button',{name:'Save workflow'}));await ui.findByText('Morning copy')
 fireEvent.click(ui.getByRole('button',{name:'Delete Morning copy'}));await waitFor(()=>assert.ok(!ui.queryByText('Morning copy')))
})
test('dashboard offers four editable templates without installing them automatically',async()=>{
 const ui=render(createElement(Dashboard));await ui.findByText('Developer Launchpad');assert.ok(ui.getByText('Deep Study'));assert.ok(ui.getByText('Research Sprint'));assert.ok(ui.getByText('Workday Start'));assert.equal(data['nova:automations:workflows'],undefined)
 fireEvent.click(ui.getByRole('button',{name:/Developer Launchpad/}));await ui.findByDisplayValue('Developer Launchpad');assert.equal((ui.getByLabelText(/Enable workflow status/) as HTMLInputElement).checked,false)
})
