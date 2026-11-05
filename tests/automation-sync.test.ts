import { test,afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',pretendToBeVisual:true})
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
const data:Record<string,any>={}, listeners=new Set<any>()
let heldRead: ((value:any)=>void)|undefined, holdPreferences=false
Object.defineProperty(globalThis,'chrome',{configurable:true,value:{storage:{local:{get:async(k:string)=>{const snapshot=data[k];if(k==='preferences'&&holdPreferences){holdPreferences=false;return await new Promise(resolve=>{heldRead=()=>resolve({[k]:snapshot})})}return {[k]:snapshot}},set:async(v:any)=>Object.assign(data,v)},onChanged:{addListener:(fn:any)=>listeners.add(fn),removeListener:(fn:any)=>listeners.delete(fn)}}}})
const {render,waitFor,act,cleanup}=await import('@testing-library/react')
const {Notes}=await import('../src/components/Notes')
const {usePreferences}=await import('../src/hooks/usePreferences')
const {DEFAULT_PREFERENCES}=await import('../src/lib/defaults')
function SettingsObserver(){const {preferences,ready}=usePreferences();return createElement('div',null,ready?`${preferences.theme}/${preferences.layout}`:'Loading')}
afterEach(()=>{cleanup();listeners.clear();holdPreferences=false;heldRead=undefined;for(const key of Object.keys(data))delete data[key]})
test('dashboard preferences update after an automation changes storage',async()=>{
 const ui=render(createElement(SettingsObserver));await ui.findByText(`${DEFAULT_PREFERENCES.theme}/${DEFAULT_PREFERENCES.layout}`)
 const next={...DEFAULT_PREFERENCES,theme:'dawn',layout:'workspace'};data.preferences=next;await act(async()=>{for(const listener of [...listeners])listener({preferences:{newValue:next}},'local')});assert.ok(ui.getByText('dawn/workspace'))
})
test('notes refresh after an external automation adds a note',async()=>{
 const ui=render(createElement(Notes));await ui.findByText(/Create your first note/);const now=new Date().toISOString();data.notes=[{id:'automated',title:'Automation note',content:'content',createdAt:now,updatedAt:now}]
 await act(async()=>{for(const listener of [...listeners])listener({notes:{newValue:data.notes}},'local')});await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Automation note'})))
})


test('a delayed initial preference read cannot overwrite a newer automation update',async()=>{
 data.preferences=DEFAULT_PREFERENCES;holdPreferences=true;const ui=render(createElement(SettingsObserver));await waitFor(()=>assert.ok(heldRead))
 const next={...DEFAULT_PREFERENCES,theme:'dawn',layout:'workspace'};data.preferences=next;await act(async()=>{for(const listener of [...listeners])listener({preferences:{newValue:next}},'local');heldRead?.(undefined)});await ui.findByText('dawn/workspace')
})
