import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'https://example.test/', pretendToBeVisual:true })
for (const [key, value] of Object.entries({ window:dom.window, document:dom.window.document, navigator:dom.window.navigator, HTMLElement:dom.window.HTMLElement, requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT:true })) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
class EventMock { listeners = new Set<(...args:any[]) => void>(); addListener = (fn: (...args:any[]) => void) => this.listeners.add(fn); removeListener = (fn: (...args:any[]) => void) => this.listeners.delete(fn); emit = (...args:any[]) => { for (const fn of this.listeners) fn(...args) } }
const tabEvents = Object.fromEntries(['onCreated','onUpdated','onRemoved','onActivated','onMoved','onAttached','onDetached','onReplaced'].map(k => [k,new EventMock()]))
const groupEvents = Object.fromEntries(['onCreated','onUpdated','onMoved','onRemoved'].map(k => [k,new EventMock()]))
const sessionEvent = new EventMock(), storageEvent = new EventMock()
const tab = (id:number, url:string, extra:any = {}) => ({ id,url,title:`Page ${id}`, windowId:1,index:id,active:false,pinned:false,incognito:false,groupId:-1, ...extra })
let tabs = [tab(1,'https://a.test/#a'), tab(2,'https://a.test/#b'),tab(3,'https://secret.test/',{incognito:true})]
let data:Record<string,any> = {}, removals:number[] = [], created:any[] = [], grouped:any[] = [], restored:string[] = [], confirms = true
Object.defineProperty(dom.window,'confirm',{value:() => confirms,configurable:true})
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{
  runtime:{getURL:(path:string) => `chrome-extension://id/${path}`},
  tabs:{...tabEvents,query:async()=>tabs,get:async(id:number)=>tabs.find(t=>t.id===id) ?? Promise.reject(new Error('gone')),remove:async(ids:number|number[])=>{removals.push(...(Array.isArray(ids)?ids:[ids]))},update:async()=>{},group:async(args:any)=>{grouped.push(args);return 5},ungroup:async()=>{},create:async(args:any)=>{created.push(args);return {id:100+created.length}}},
  windows:{getCurrent:async()=>({id:1,incognito:false}),update:async()=>{}},
  tabGroups:{...groupEvents,query:async()=>[],update:async()=>{}},
  sessions:{onChanged:sessionEvent,getRecentlyClosed:async()=>[{lastModified:1700000000,tab:{title:'Recently closed page',url:'https://closed.test/',sessionId:'recent-1'}}],restore:async(id:string)=>{restored.push(id)}},
  storage:{onChanged:storageEvent,local:{get:async(key:string)=>({[key]:data[key]}),set:async(value:any)=>{Object.assign(data,value);storageEvent.emit(Object.fromEntries(Object.keys(value).map(k=>[k,{newValue:value[k]}])),'local')}}},
}})
const { render,fireEvent,waitFor,cleanup,act } = await import('@testing-library/react')
const { Command } = await import('../src/command/Command')
afterEach(() => { cleanup(); tabs=[tab(1,'https://a.test/#a'),tab(2,'https://a.test/#b'),tab(3,'https://secret.test/',{incognito:true})]; data={}; removals=[];created=[];grouped=[];restored=[];confirms=true })

test('tab search, selection and native grouping require explicit confirmation', async () => {
  const ui=render(createElement(Command)); await ui.findByText('Page 1')
  fireEvent.change(ui.getByRole('textbox',{name:/search tabs/i}),{target:{value:'secret.test'}})
  assert.equal(ui.queryByText('Page 1'),null); assert.ok(ui.getByText('Page 3'))
  fireEvent.change(ui.getByRole('textbox',{name:/search tabs/i}),{target:{value:''}})
  fireEvent.click(ui.getByRole('checkbox',{name:'Select Page 1'})); fireEvent.click(ui.getByRole('button',{name:/Group selected/}))
  fireEvent.click(ui.getByRole('button',{name:'Research'})); confirms=false
  fireEvent.click(ui.getByRole('button',{name:'Create group'})); assert.equal(grouped.length,0)
  confirms=true; fireEvent.click(ui.getByRole('button',{name:'Create group'})); await waitFor(()=>assert.equal(grouped.length,1)); assert.deepEqual(grouped[0].tabIds,[1])
})

test('duplicate review and closing a tab are both confirmation gated', async () => {
  const ui=render(createElement(Command)); await ui.findByText('Page 1'); confirms=false
  fireEvent.click(ui.getByRole('button',{name:'Close Page 1'})); assert.equal(removals.length,0)
  fireEvent.click(ui.getByRole('button',{name:/Duplicates/})); fireEvent.click(ui.getByRole('button',{name:'Close others'})); assert.equal(removals.length,0)
  confirms=true; fireEvent.click(ui.getByRole('button',{name:'Close others'})); await waitFor(()=>assert.deepEqual(removals,[2])); assert.match(ui.getByRole('status').textContent || '', /Closed 1/)
})

test('workspace save excludes private and unsupported tabs, restore skips open URLs', async () => {
  tabs.push(tab(4,'chrome://settings'))
  const ui=render(createElement(Command)); await ui.findByText('Page 1'); fireEvent.click(ui.getByRole('button',{name:'Workspaces'}))
  const input=ui.getByRole('textbox',{name:'Workspace name'}); fireEvent.change(input,{target:{value:'Project'}})
  const save=ui.getByRole('button',{name:'Save current window'}); await waitFor(()=>assert.equal((save as HTMLButtonElement).disabled,false)); fireEvent.click(save)
  await ui.findByText('Project'); assert.equal(data['nova:savedSessions'][0].tabs.length,2); assert.ok(data['nova:savedSessions'][0].tabs.every((t:any)=>!t.url.includes('secret')))
  fireEvent.click(ui.getByRole('button',{name:'Restore all'})); await waitFor(()=>assert.match(ui.getByRole('status').textContent || '',/Opened 0; skipped 2/)); assert.equal(created.length,0)
})

test('recent recovery uses native session id and browser event listeners are cleaned up', async () => {
  const ui=render(createElement(Command)); await ui.findByText('Page 1'); assert.equal(tabEvents.onUpdated.listeners.size,1)
  act(()=>{ tabs=[...tabs,tab(8,'https://new.test/')]; tabEvents.onCreated.emit(tabs.at(-1)) }); assert.ok(ui.getByText('Page 8'))
  act(()=>{ tabs=tabs.filter(t=>t.id!==8); tabEvents.onRemoved.emit(8) }); assert.equal(ui.queryByText('Page 8'),null)
  fireEvent.click(ui.getByRole('button',{name:/Recently closed/})); assert.ok(ui.getByText('Recently closed page')); fireEvent.click(ui.getByRole('button',{name:'Restore'})); await waitFor(()=>assert.deepEqual(restored,['recent-1']))
  ui.unmount(); assert.ok(Object.values(tabEvents).every(e=>e.listeners.size===0)); assert.ok(Object.values(groupEvents).every(e=>e.listeners.size===0)); assert.equal(sessionEvent.listeners.size,0)
})

test('an event during the initial query cannot be overwritten by its stale snapshot', async () => {
  let resolveQuery!: (value:any[]) => void
  const original = chrome.tabs.query
  let calls = 0
  ;(chrome.tabs.query as any) = () => { calls++; return calls === 1 ? new Promise(resolve => { resolveQuery=resolve }) : Promise.resolve(tabs) }
  try {
    const ui=render(createElement(Command))
    await waitFor(()=>assert.equal(calls,1))
    act(()=>{ tabs=[...tabs,tab(9,'https://fresh.test/')]; tabEvents.onCreated.emit(tabs.at(-1)); resolveQuery(tabs.filter(t=>t.id!==9)) })
    await ui.findByText('Page 9'); assert.ok(calls>=2)
  } finally { (chrome.tabs.query as any) = original }
})

test('restoring over ten saved tabs asks for confirmation before opening', async () => {
  data['nova:savedSessions']=[{id:'x',name:'Large',createdAt:1,updatedAt:1,tabs:Array.from({length:11},(_,i)=>({title:`Tab ${i}`,url:`https://site${i}.test/`}))}]
  const ui=render(createElement(Command)); await ui.findByText('Page 1'); fireEvent.click(ui.getByRole('button',{name:'Workspaces'})); await ui.findByText('Large')
  confirms=false; fireEvent.click(ui.getByRole('button',{name:'Restore all'})); assert.equal(created.length,0)
  confirms=true; fireEvent.click(ui.getByRole('button',{name:'Restore all'})); await waitFor(()=>assert.equal(created.length,11))
})
