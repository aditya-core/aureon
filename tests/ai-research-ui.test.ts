import { test,afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import 'fake-indexeddb/auto'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://extension.test/research.html?tab=1',pretendToBeVisual:true})
for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true})
Object.defineProperty(dom.window,'confirm',{value:()=>true,configurable:true})
const local:Record<string,any>={}, session:Record<string,any>={'nova:aiConnection':{url:'https://backend.example',token:'user-token'}}
let privateTab=false,requests:any[]=[]
const tab=()=>({id:1,windowId:1,incognito:privateTab,url:'https://example.test/article',title:'A thoughtful article'})
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{windows:{getCurrent:async()=>({id:1,incognito:privateTab})},runtime:{getURL:(s:string)=>`chrome-extension://id/${s}`},tabs:{query:async()=>[tab()],get:async()=>tab()},scripting:{executeScript:async()=>[{result:{title:'Article',url:'https://example.test/article',sourceHref:'https://example.test/article',text:'PRIVATE PAGE CONTENT',truncated:false}}]},storage:{local:{get:async(k:string)=>({[k]:local[k]}),set:async(v:any)=>Object.assign(local,v)},session:{get:async(k:string)=>({[k]:session[k]}),set:async(v:any)=>Object.assign(session,v),remove:async(k:string)=>delete session[k]}},permissions:{request:async()=>true}}})
const originalFetch=globalThis.fetch
globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));return new Response('event: delta\ndata: {"text":"A grounded answer"}\n\nevent: done\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}})}
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react')
const {Assistant}=await import('../src/ai/Assistant')
const {Research}=await import('../src/research/Research')
afterEach(()=>{cleanup();requests=[];privateTab=false;for(const k of Object.keys(local))delete local[k]})

test('assistant previews context and requires explicit approval before any AI request',async()=>{
  const ui=render(createElement(Assistant));await ui.findByRole('button',{name:/Understand this page/});fireEvent.click(ui.getByRole('button',{name:/Understand this page/}));await ui.findByText('PRIVATE PAGE CONTENT')
  fireEvent.click(ui.getByRole('button',{name:'Run summarise'}));await ui.findByRole('alert');assert.equal(requests.length,0)
  fireEvent.click(ui.getByRole('checkbox',{name:/I approve sending/}));fireEvent.click(ui.getByRole('button',{name:'Run summarise'}))
  await ui.findByText('A grounded answer');assert.equal(requests.length,1);assert.equal(requests[0].context.text,'PRIVATE PAGE CONTENT')
  ui.unmount();await waitFor(()=>assert.ok(local['nova:aiChats']));assert.doesNotMatch(JSON.stringify(local['nova:aiChats']),/PRIVATE PAGE CONTENT/)
})
test('assistant is unavailable in private windows',async()=>{
  privateTab=true;const ui=render(createElement(Assistant));await ui.findByText('NOVA Assistant is unavailable in private windows.');assert.equal(requests.length,0);assert.equal(ui.queryByRole('textbox',{name:'Message NOVA'}),null)
})
test('research workspace saves current page locally and searches it without AI',async()=>{
  const ui=render(createElement(Research));await ui.findByRole('button',{name:'Save current page'});fireEvent.click(ui.getByRole('button',{name:'Save current page'}));await waitFor(()=>assert.ok(ui.getAllByText('A thoughtful article').length>0));assert.equal(requests.length,0)
  fireEvent.change(ui.getByRole('textbox',{name:'Search saved knowledge'}),{target:{value:'nothing-matches'}});await ui.findByText(/Nothing here yet/)
  fireEvent.change(ui.getByRole('textbox',{name:'Search saved knowledge'}),{target:{value:'thoughtful'}});assert.ok(ui.getAllByText('A thoughtful article').length>0)
})
afterEach(()=>{globalThis.fetch=originalFetch;globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));return new Response('event: delta\ndata: {"text":"A grounded answer"}\n\nevent: done\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}})}})
