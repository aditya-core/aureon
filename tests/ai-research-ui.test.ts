import { test,afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import 'fake-indexeddb/auto'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://extension.test/research.html?tab=1',pretendToBeVisual:true})
for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true})
let confirmResult=true
Object.defineProperty(dom.window,'confirm',{value:()=>confirmResult,configurable:true})
const local:Record<string,any>={}, session:Record<string,any>={'nova:aiConnection':{url:'https://backend.example',token:'user-token'}}
let failChats=false,privateTab=false,tabUrl='https://example.test/article',requests:any[]=[]
const tab=()=>({id:1,windowId:1,incognito:privateTab,url:tabUrl,title:'A thoughtful article'})
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{windows:{getCurrent:async()=>({id:1,incognito:privateTab})},runtime:{getURL:(s:string)=>`chrome-extension://id/${s}`},tabs:{query:async()=>[tab()],get:async()=>tab()},scripting:{executeScript:async()=>[{result:{title:'Article',url:'https://example.test/article',sourceHref:'https://example.test/article',text:'PRIVATE PAGE CONTENT',truncated:false}}]},storage:{local:{get:async(k:string)=>{if(k==='nova:aiChats'&&failChats)throw new Error('storage unavailable');return {[k]:local[k]}},set:async(v:any)=>Object.assign(local,v)},session:{get:async(k:string)=>({[k]:session[k]}),set:async(v:any)=>Object.assign(session,v),remove:async(k:string)=>delete session[k]}},permissions:{request:async()=>true}}})
const originalFetch=globalThis.fetch
globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));return new Response('event: delta\ndata: {"text":"A grounded answer"}\n\nevent: done\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}})}
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react')
const {Assistant}=await import('../src/ai/Assistant')
const {Research}=await import('../src/research/Research')
const {createResearchBackup}=await import('../src/research/transfer')
const {getPages}=await import('../src/research/db')
afterEach(()=>{cleanup();requests=[];confirmResult=true;failChats=false;privateTab=false;tabUrl='https://example.test/article';session['nova:aiConnection']={url:'https://backend.example',token:'user-token'};for(const k of Object.keys(local))delete local[k]})

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
  const ui=render(createElement(Research));await ui.findByText(/Ready to save:/);fireEvent.click(ui.getByRole('button',{name:'Save current page'}));await waitFor(()=>assert.ok(ui.getAllByText('A thoughtful article').length>0));assert.equal(requests.length,0)
  fireEvent.change(ui.getByRole('textbox',{name:'Search saved knowledge'}),{target:{value:'nothing-matches'}});await ui.findByText(/Nothing here yet/)
  fireEvent.change(ui.getByRole('textbox',{name:'Search saved knowledge'}),{target:{value:'thoughtful'}});assert.ok(ui.getAllByText('A thoughtful article').length>0)
})
afterEach(()=>{globalThis.fetch=originalFetch;globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(String(options?.body)));return new Response('event: delta\ndata: {"text":"A grounded answer"}\n\nevent: done\ndata: {}\n\n',{headers:{'Content-Type':'text/event-stream'}})}})


test('assistant preserves a question when no backend is connected',async()=>{
  delete session['nova:aiConnection']
  const ui=render(createElement(Assistant));await ui.findByRole('textbox',{name:'Message NOVA'})
  fireEvent.change(ui.getByRole('textbox',{name:'Message NOVA'}),{target:{value:'Explain this idea'}});await waitFor(()=>assert.equal((ui.getByRole('button',{name:'Send message'}) as HTMLButtonElement).disabled,false));fireEvent.click(ui.getByRole('button',{name:'Send message'}))
  await ui.findByText(/Connect your NOVA backend first/);assert.equal((ui.getByRole('textbox',{name:'Message NOVA'}) as HTMLTextAreaElement).value,'Explain this idea');assert.equal(requests.length,0);assert.ok(ui.getByText('Connect your backend'))
})
test('assistant refuses to send approved context after the source tab navigates',async()=>{
  const ui=render(createElement(Assistant));await ui.findByRole('button',{name:/Understand this page/});fireEvent.click(ui.getByRole('button',{name:/Understand this page/}));await ui.findByText('PRIVATE PAGE CONTENT')
  fireEvent.click(ui.getByRole('checkbox',{name:/I approve sending/}));tabUrl='https://example.test/different-page';fireEvent.click(ui.getByRole('button',{name:'Run summarise'}))
  await ui.findByText(/active page changed/);assert.equal(requests.length,0);assert.equal((ui.getByRole('checkbox',{name:/I approve sending/}) as HTMLInputElement).checked,false)
})
test('research supports adding a link without an active source page',async()=>{
  const ui=render(createElement(Research));await ui.findByRole('button',{name:'Add a link'});fireEvent.click(ui.getByRole('button',{name:'Add a link'}))
  fireEvent.change(ui.getByLabelText('Website URL'),{target:{value:'https://fresh.test/guide'}});fireEvent.change(ui.getByLabelText('Title (optional)'),{target:{value:'Fresh guide'}});fireEvent.click(ui.getByRole('button',{name:'Save link'}));await ui.findAllByText('Fresh guide');assert.equal(requests.length,0)
})


test('research does not silently save a tab that navigated since its preview',async()=>{
  const ui=render(createElement(Research));await ui.findByText(/Ready to save:/)
  tabUrl='https://different.test/new';fireEvent.click(ui.getByRole('button',{name:'Save current page'}))
  await ui.findByText(/source page changed/i);assert.equal(ui.queryAllByRole('button',{name:/different.test/}).length,0)
  assert.match(ui.getByRole('status').textContent || '',/different\.test/)
})


test('a failed history read never replaces existing conversations with a blank chat',async()=>{
  const stored=[{id:'old',title:'Keep me',messages:[{role:'user',content:'Important'}],updatedAt:1}];local['nova:aiChats']=stored;failChats=true
  const ui=render(createElement(Assistant));await ui.findByText(/Chat history could not be loaded/);assert.equal((ui.getByRole('button',{name:'New conversation'}) as HTMLButtonElement).disabled,true)
  ui.unmount();assert.deepEqual(local['nova:aiChats'],stored)
})
test('research card generation refuses a source that navigated after approval',async()=>{
  const ui=render(createElement(Research));await ui.findByText(/Ready to save:/);fireEvent.click(ui.getByRole('button',{name:'Save current page'}));await ui.findByRole('button',{name:/Generate knowledge card/})
  fireEvent.click(ui.getByRole('button',{name:/Generate knowledge card/}));await ui.findByText('PRIVATE PAGE CONTENT');fireEvent.click(ui.getByRole('checkbox',{name:/I approve sending/}));tabUrl='https://different.test/new'
  fireEvent.click(ui.getByRole('button',{name:'Generate card'}));await ui.findByText(/source page changed or closed/i);assert.equal(requests.length,0);assert.equal((ui.getByRole('checkbox',{name:/I approve sending/}) as HTMLInputElement).checked,false)
})


test('research backup import requires confirmation and merges after approval',async()=>{
  const ui=render(createElement(Research));await ui.findByText(/Ready to save:/);fireEvent.click(ui.getByText('Back up or restore your library'))
  const json=createResearchBackup([],[{id:'import-page',url:'https://backup.test/',urlKey:'',title:'Imported page',description:'',tags:[],notes:'Kept note',relatedIds:[],collectionId:null,createdAt:1,updatedAt:1}])
  const file={size:json.length,text:async()=>json},input=ui.getByLabelText('Import backup')
  confirmResult=false;fireEvent.change(input,{target:{files:[file]}});await waitFor(()=>assert.equal((input as HTMLInputElement).disabled,false));assert.equal((await getPages()).some(p=>p.id==='import-page'),false)
  confirmResult=true;fireEvent.change(input,{target:{files:[file]}});await ui.findByText(/Imported 1 pages/);assert.equal((await getPages()).find(p=>p.id==='import-page')?.notes,'Kept note')
})
