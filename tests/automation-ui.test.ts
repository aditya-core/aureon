import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://extension.test/automations.html',pretendToBeVisual:true})
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
const {render,fireEvent,cleanup,waitFor}=await import('@testing-library/react')
const {newWorkflow,newAction}=await import('../src/automation/model')
const {templates}=await import('../src/automation/templates')
const {default:Editor}=await import('../src/automation/WorkflowEditor')
afterEach(cleanup)
test('editor configures, reorders, previews and saves a workflow',async()=>{
 let saved:any=null;const initial={...newWorkflow(),name:'My workflow',actions:[{...newAction('openUrl'),config:{url:'https://example.test/'}},newAction('focus')]}
 const ui=render(createElement(Editor,{initial,sessions:[],onClose:()=>{},onSave:async w=>{saved=w},onTest:async()=>{}}))
 assert.equal(ui.getAllByText('Open website')[0].closest('article')?.textContent?.includes('01'),true)
 fireEvent.click(ui.getByRole('button',{name:'Move step 2 up'}));assert.equal(ui.getAllByText('Start focus timer')[0].closest('article')?.textContent?.includes('01'),true)
 fireEvent.change(ui.getByLabelText('Trigger'),{target:{value:'scheduled'}});assert.equal((ui.getByLabelText(/Enable automatic trigger/) as HTMLInputElement).checked,false)
 fireEvent.change(ui.getByLabelText('Local time'),{target:{value:'08:45'}});fireEvent.click(ui.getByRole('button',{name:'Preview'}));assert.ok(ui.getByText(/scheduled · automatic trigger off/))
 fireEvent.click(ui.getByRole('button',{name:'Save workflow'}));await waitFor(()=>assert.ok(saved));assert.equal(saved.actions[0].type,'focus');assert.equal(saved.trigger.time,'08:45');assert.equal(saved.enabled,false)
})
test('editor shows validation errors and templates are independent editable disabled copies',async()=>{
 const ui=render(createElement(Editor,{initial:newWorkflow(),sessions:[],onClose:()=>{},onSave:async()=>{},onTest:async()=>{}}));fireEvent.click(ui.getByRole('button',{name:'Save workflow'}));assert.match(ui.getByRole('alert').textContent||'',/workflow name/)
 assert.equal(templates.length,4);for(const t of templates){const a=t.create(),b=t.create();assert.equal(a.enabled,false);assert.notEqual(a.id,b.id);assert.ok(a.actions.length)}
})
