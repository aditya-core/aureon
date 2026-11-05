import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.test/',pretendToBeVisual:true})
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
const opened:any[]=[]
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{runtime:{id:'extension-id'},windows:{getCurrent:async()=>({id:7})},sidePanel:{open:(args:any)=>{opened.push(args);return Promise.resolve()}}}})
const {render,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react')
const {Spaces}=await import('../src/components/Spaces')
afterEach(()=>{cleanup();opened.length=0})
test('spaces launcher discovers features, closes on Escape, and returns focus',async()=>{
  const ui=render(createElement(Spaces)), trigger=ui.getByRole('button',{name:'Explore NOVA'})
  await act(async()=>{})
  fireEvent.click(trigger);assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.ok(ui.getByRole('link',{name:/Command Centre/}));assert.ok(ui.getByRole('link',{name:/Research library/}))
  fireEvent.keyDown(document,{key:'Escape'});assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,trigger)
})
test('assistant opens synchronously from a user action',async()=>{
  const ui=render(createElement(Spaces));await act(async()=>{});fireEvent.click(ui.getByRole('button',{name:'Explore NOVA'}));await waitFor(()=>assert.ok(ui.getByRole('button',{name:/Assistant/})));await waitFor(()=>assert.equal(ui.getByRole('button',{name:/Assistant/}).disabled,false))
  // getCurrent resolves before the click; sidePanel.open is called directly by its handler.
  await waitFor(()=>assert.equal(ui.getByRole('button',{name:/Assistant/}).textContent?.includes('Assistant'),true))
  fireEvent.click(ui.getByRole('button',{name:/Assistant/}));assert.deepEqual(opened,[{windowId:7}]);assert.ok((await ui.findByRole('status')).textContent?.includes('browser toolbar'))
})
