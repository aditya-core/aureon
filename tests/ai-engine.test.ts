import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { extractDocument, supportedPage, capture } from '../src/ai/context'
import { backendUrl, streamAI } from '../src/ai/client'
function setup(html:string,url='https://example.test/article?token=secret#part'){
  const dom=new JSDOM(html,{url,pretendToBeVisual:true})
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,Element:dom.window.Element,NodeFilter:dom.window.NodeFilter,getComputedStyle:dom.window.getComputedStyle.bind(dom.window)}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
  return dom
}
const tab=(url:string,incognito=false)=>({id:1,url,incognito,windowId:1} as chrome.tabs.Tab)

test('context extraction omits hidden, form, navigation, and query data',()=>{
  setup('<title>Article</title><nav><p>Navigation secret</p></nav><main><h1>Heading</h1><p>Visible <span style="display:none">HIDDEN</span> paragraph</p><form><input value="private"><p>form secret</p></form><p aria-hidden="true">hidden second</p><p style="opacity:0">transparent secret</p><details><summary>More</summary><p>closed secret</p></details></main>')
  const result=extractDocument('page',24000)
  assert.equal(result.title,'Article');assert.equal(result.url,'https://example.test/article');assert.match(result.text,/Heading/);assert.match(result.text,/Visible.*paragraph/);assert.doesNotMatch(result.text,/HIDDEN|secret|hidden second|private/)
})
test('context is bounded and pages with password fields are blocked',()=>{
  setup('<main><p>'+ 'x'.repeat(100)+' </p></main>');const result=extractDocument('page',20);assert.equal(result.text.length,20);assert.equal(result.truncated,true)
  setup('<main><p>text</p><input type="password" value="secret"></main>');assert.throws(()=>extractDocument('page',100),/password fields/)
})
test('selection only extracts explicitly selected visible text',()=>{
  const dom=setup('<main><p>Hello <b>selected text</b> ending</p></main>')
  const node=dom.window.document.querySelector('b')!.firstChild!;const range=dom.window.document.createRange();range.setStart(node,0);range.setEnd(node,8);const selection=dom.window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
  assert.equal(extractDocument('selection',100).text,'selected')
})
test('sensitive, internal, credentialed and private pages are blocked',()=>{
  assert.ok(supportedPage(tab('chrome://settings')));assert.ok(supportedPage(tab('https://online.bank.example/')));assert.ok(supportedPage(tab('https://example.com/login')));assert.ok(supportedPage(tab('https://user:pass@example.com/')));assert.ok(supportedPage(tab('https://example.com/',true)));assert.equal(supportedPage(tab('https://example.com/article')),null)
})
test('capture refuses private tabs before script injection and detects navigation',async()=>{
  let calls=0
  Object.defineProperty(globalThis,'chrome',{configurable:true,value:{scripting:{executeScript:async()=>{calls++;return [{result:{title:'a',url:'https://example.com/old',sourceHref:'https://example.com/old',text:'x',truncated:false}}]}},tabs:{get:async()=>tab('https://example.com/new')}}})
  await assert.rejects(capture(tab('https://example.com/',true),'page'),/Private/);assert.equal(calls,0)
  await assert.rejects(capture(tab('https://example.com/old'),'page'),/changed/);assert.equal(calls,1)
})
test('backend URL requires HTTPS except local development and disallows credentials',()=>{
  assert.throws(()=>backendUrl('http://example.com'),/HTTPS/);assert.throws(()=>backendUrl('https://user:pass@example.com'),/clean/);assert.equal(backendUrl('http://localhost:8000').hostname,'localhost')
})
test('SSE client reconstructs split events and rejects uncompleted streams',async()=>{
  const original=globalThis.fetch
  try{
    globalThis.fetch=async()=>new Response(new ReadableStream({start(c){const e=new TextEncoder();for(const s of ['event: del','ta\ndata: {"text":"Hel','lo"}\n\nevent: done\ndata: {}\n\n'])c.enqueue(e.encode(s));c.close()}}),{headers:{'Content-Type':'text/event-stream'}})
    let output='';await streamAI({url:'https://backend.example',token:'account'},'chat',{message:'hi'},new AbortController().signal,s=>output+=s);assert.equal(output,'Hello')
    globalThis.fetch=async()=>new Response('event: delta\ndata: {"text":"x"}\n\n',{headers:{'Content-Type':'text/event-stream'}})
    await assert.rejects(streamAI({url:'https://backend.example',token:'account'},'chat',{},new AbortController().signal,()=>{}),/ended unexpectedly/)
  }finally{globalThis.fetch=original}
})

test('stream request can be cancelled without waiting for a response',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>{ options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))) })
    const controller=new AbortController();const pending=streamAI({url:'https://backend.example',token:'account'},'chat',{},controller.signal,()=>{});controller.abort()
    await assert.rejects(pending,(e:Error)=>e.name==='AbortError')
  }finally{globalThis.fetch=original}
})

test('SSE client reports structured backend failures and stream errors',async()=>{
  const original=globalThis.fetch
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'Daily limit reached.'}}),{status:429,headers:{'Content-Type':'application/json'}})
    await assert.rejects(streamAI({url:'https://backend.example',token:'account'},'chat',{},new AbortController().signal,()=>{}),/Daily limit/)
    globalThis.fetch=async()=>new Response('event: error\ndata: {"message":"AI unavailable"}\n\n',{headers:{'Content-Type':'text/event-stream'}})
    await assert.rejects(streamAI({url:'https://backend.example',token:'account'},'chat',{},new AbortController().signal,()=>{}),/AI unavailable/)
  }finally{globalThis.fetch=original}
})
