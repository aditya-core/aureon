import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/', pretendToBeVisual: true })
Object.defineProperty(dom.window, 'PointerEvent', { value: dom.window.MouseEvent, configurable: true })
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, PointerEvent: dom.window.MouseEvent, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
class EventMock { listeners = new Set<(...args:any[]) => void>(); addListener = (fn:(...args:any[])=>void) => this.listeners.add(fn); removeListener = (fn:(...args:any[])=>void) => this.listeners.delete(fn); emit = (...args:any[]) => { for (const fn of this.listeners) fn(...args) } }
const tabEvents = Object.fromEntries(['onCreated','onUpdated','onRemoved','onActivated','onMoved','onAttached','onDetached','onReplaced'].map(name => [name,new EventMock()]))
const groupEvents = Object.fromEntries(['onCreated','onUpdated','onMoved','onRemoved'].map(name => [name,new EventMock()]))
const windowEvents = Object.fromEntries(['onCreated','onRemoved'].map(name => [name,new EventMock()]))
const sessionEvent = new EventMock()
const tab = (id:number, extra:any = {}) => ({ id, url:`https://site${id}.test/`, title:`Page ${id}`, windowId:1, index:id, active:false, pinned:false, incognito:false, groupId:-1, lastAccessed:1000-id, ...extra })
let tabs = [tab(1), tab(2), tab(3), tab(4), tab(5), tab(6), tab(7), tab(8,{incognito:true})]
let calls:any[] = [], closed = 0, expanded = 0, failWindow = false
const chromeMock = {
 runtime:{ getURL:(path:string)=>`chrome-extension://id/${path}` },
 tabs:{ ...tabEvents, query:async()=>tabs.slice(), get:async(id:number)=>{ const item=tabs.find(t=>t.id===id);if(!item)throw new Error('Tab no longer exists');return {...item} }, update:async(id:number,options:any)=>{calls.push(['tab',id,options])} },
 windows:{ ...windowEvents, getCurrent:async()=>({id:1,incognito:false}), update:async(id:number,options:any)=>{calls.push(['window',id,options]);if(failWindow)throw new Error('Window unavailable')} },
 tabGroups:{ ...groupEvents,query:async()=>[] }, sessions:{onChanged:sessionEvent,getRecentlyClosed:async()=>[]}, storage:{local:{}}
}
Object.defineProperty(globalThis,'chrome',{value:chromeMock,configurable:true,writable:true})
const {render,fireEvent,waitFor,cleanup,act,within}=await import('@testing-library/react')
const {default:Switcher}=await import('../src/switcher/Switcher')
const props={onClose:()=>{closed++},onExpand:()=>{expanded++}}
afterEach(()=>{cleanup();tabs=[tab(1),tab(2),tab(3),tab(4),tab(5),tab(6),tab(7),tab(8,{incognito:true})];calls=[];closed=0;expanded=0;failWindow=false;Object.defineProperty(globalThis,'chrome',{value:chromeMock,configurable:true,writable:true})})

test('switcher displays recent normal tabs and switches a selected Chrome tab',async()=>{
 const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));assert.ok(!ui.queryByRole('button',{name:'Switch to Page 8'}));assert.ok(ui.getByText(/NO SCREENSHOTS CAPTURED/))
 fireEvent.click(ui.getByRole('button',{name:'Next tab'}));assert.equal(ui.getByRole('button',{name:'Switch to Page 2'}).getAttribute('aria-current'),'true')
 fireEvent.click(ui.getByRole('button',{name:'Switch to Page 2'}));await waitFor(()=>assert.equal(closed,1));assert.deepEqual(calls,[['tab',2,{active:true}],['window',1,{focused:true}]])
})
test('arrow keys and swipe move through tabs without activating them',async()=>{
 const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));const card=ui.getByRole('button',{name:'Switch to Page 1'});card.focus();fireEvent.keyDown(card,{key:'ArrowRight'});await waitFor(()=>assert.equal(ui.getByRole('button',{name:'Switch to Page 2'}).getAttribute('aria-current'),'true'));await waitFor(()=>assert.ok(document.activeElement===ui.getByRole('button',{name:'Switch to Page 2'})))
 const deck=ui.getByLabelText('Recent Chrome tabs');fireEvent.pointerDown(deck,{clientX:200,clientY:50});fireEvent.pointerUp(deck,{clientX:80,clientY:55});assert.equal(ui.getByRole('button',{name:'Switch to Page 3'}).getAttribute('aria-current'),'true');fireEvent.click(ui.getByRole('button',{name:'Switch to Page 3'}));assert.deepEqual(calls,[])
})
test('expand opens Tab Space, Escape closes and browser listeners are cleaned up',async()=>{
 const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));assert.equal(tabEvents.onUpdated.listeners.size,1);fireEvent.click(ui.getByRole('button',{name:/Open Tab Space/}));assert.equal(expanded,1);fireEvent.keyDown(document,{key:'Escape'});assert.equal(closed,1);ui.unmount();assert.equal(tabEvents.onUpdated.listeners.size,0);assert.equal(sessionEvent.listeners.size,0)
})
test('external tab events update the deck and missing tabs report errors',async()=>{
 const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));await act(async()=>{tabs=tabs.filter(t=>t.id!==1);tabEvents.onRemoved.emit(1,{windowId:1})});assert.ok(!ui.queryByRole('button',{name:'Switch to Page 1'}));assert.ok(ui.getByRole('button',{name:'Switch to Page 2'}))
 tabs=tabs.filter(t=>t.id!==2);fireEvent.click(ui.getByRole('button',{name:'Switch to Page 2'}));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/Tab no longer exists/));assert.equal(closed,0)
})
test('partial focus failures do not pretend switching succeeded',async()=>{
 failWindow=true;const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));fireEvent.click(ui.getByRole('button',{name:'Switch to Page 1'}));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/may already be active/));assert.equal(closed,0)
})
test('large collections mount at most five cards while all tabs stay navigable',async()=>{
 tabs=Array.from({length:500},(_,i)=>tab(i+1));const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));const deck=ui.getByLabelText('Recent Chrome tabs');assert.ok(within(deck).getAllByRole('button').length<=5)
 for(let i=0;i<10;i++)fireEvent.click(ui.getByRole('button',{name:'Next tab'}));assert.equal(ui.getByRole('button',{name:'Switch to Page 11'}).getAttribute('aria-current'),'true');assert.ok(within(deck).getAllByRole('button').length<=5)
})
test('web preview shows no fake tabs and still permits expanding',async()=>{
 Object.defineProperty(globalThis,'chrome',{value:undefined,configurable:true,writable:true});const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByText('Made for your browser.'));assert.ok(!ui.queryByLabelText('Recent Chrome tabs'));fireEvent.click(ui.getByRole('button',{name:/Open Tab Space/}));assert.equal(expanded,1)
})
test('snapshot failure offers retry without presenting stale tabs',async()=>{
 const original=chromeMock.tabs.query;let fail=true;chromeMock.tabs.query=async()=>{if(fail)throw new Error('Snapshot failed');return original()}
 try{const ui=render(createElement(Switcher,props));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/Snapshot failed/));assert.ok(!ui.queryByRole('button',{name:'Switch to Page 1'}));fail=false;fireEvent.click(ui.getByRole('button',{name:'Try again'}));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}))}finally{chromeMock.tabs.query=original}
})
test('a switch completing after the dialog unmounts does not close another view',async()=>{
 const original=chromeMock.windows.update;let finish:()=>void=()=>{},started:()=>void=()=>{};const began=new Promise<void>(resolve=>{started=resolve})
 try{chromeMock.windows.update=async()=>{started();await new Promise<void>(resolve=>{finish=resolve})};const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));fireEvent.click(ui.getByRole('button',{name:'Switch to Page 1'}));await began;ui.unmount();await act(async()=>{finish()});assert.equal(closed,0)}finally{chromeMock.windows.update=original}
})
test('dialog traps keyboard focus and Escape dismisses it',async()=>{
 const ui=render(createElement(Switcher,props));await waitFor(()=>ui.getByRole('button',{name:'Switch to Page 1'}));const dialog=ui.getByRole('dialog');assert.ok(document.activeElement===dialog);fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});assert.ok(document.activeElement===ui.getByRole('button',{name:/Open Tab Space/}));fireEvent.keyDown(document,{key:'Escape'});assert.equal(closed,1)
})
