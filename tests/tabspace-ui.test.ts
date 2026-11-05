import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.test/',pretendToBeVisual:true})
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
class EventMock{listeners=new Set<(...args:any[])=>void>();addListener=(fn:(...args:any[])=>void)=>this.listeners.add(fn);removeListener=(fn:(...args:any[])=>void)=>this.listeners.delete(fn);emit=(...args:any[])=>{for(const fn of this.listeners)fn(...args)}}
const tabEvents=Object.fromEntries(['onCreated','onUpdated','onRemoved','onActivated','onMoved','onAttached','onDetached','onReplaced'].map(k=>[k,new EventMock()]))
const groupEvents=Object.fromEntries(['onCreated','onUpdated','onMoved','onRemoved'].map(k=>[k,new EventMock()]))
const windowEvents=Object.fromEntries(['onCreated','onRemoved'].map(k=>[k,new EventMock()])),sessionEvent=new EventMock(),storageEvent=new EventMock()
const tab=(id:number,url:string,extra:any={})=>({id,url,title:`Page ${id}`,windowId:1,index:id-1,active:false,pinned:false,incognito:false,groupId:-1,...extra})
let tabs:any[]=[tab(1,'https://a.test/?q=1#x',{active:true}),tab(2,'https://a.test/?q=1#x'),tab(3,'https://a.test/?q=1#y'),tab(4,'https://private.test/',{incognito:true})],groups:any[]=[],data:Record<string,any>={},calls:any[]=[],confirm=true,failId:number|null=null,queryCount=0,nextId=20
Object.defineProperty(dom.window,'confirm',{value:()=>confirm,configurable:true});Object.defineProperty(dom.window,'prompt',{value:()=>null,configurable:true})
const mock={runtime:{getURL:(path:string)=>`chrome-extension://id/${path}`},tabs:{...tabEvents,
 query:async(args:any)=>{queryCount++;return args.windowId?tabs.filter(t=>t.windowId===args.windowId):tabs.slice()},get:async(id:number)=>{const found=tabs.find(t=>t.id===id);if(!found)throw new Error('Tab gone');return {...found}},
 update:async(id:number,changes:any)=>{calls.push(['update',id,changes]);const t=tabs.find(x=>x.id===id);if(!t)throw new Error('Tab gone');Object.assign(t,changes);if('muted'in changes)t.mutedInfo={muted:changes.muted};tabEvents.onUpdated.emit(id,changes,{...t});return {...t}},
 remove:async(id:number)=>{calls.push(['remove',id]);if(id===failId)throw new Error('Cannot close');tabs=tabs.filter(t=>t.id!==id);tabEvents.onRemoved.emit(id,{windowId:1})},
 duplicate:async(id:number)=>{calls.push(['duplicate',id]);return {}},reload:async(id:number)=>{calls.push(['reload',id])},move:async(id:number,options:any)=>{calls.push(['move',id,options]);return {}},
 group:async(args:any)=>{calls.push(['group',args]);return 9},ungroup:async(ids:number[])=>{calls.push(['ungroup',ids])},
 create:async(args:any)=>{calls.push(['create',args]);const t=tab(nextId++,args.url,{windowId:args.windowId});tabs.push(t);tabEvents.onCreated.emit({...t});return t}},
 windows:{...windowEvents,getCurrent:async()=>({id:1,incognito:false}),update:async(...args:any[])=>{calls.push(['window-update',...args])},create:async(args:any)=>{calls.push(['window-create',args]);if(args.tabId){const t=tabs.find(t=>t.id===args.tabId);if(t)t.windowId=8;return{id:8,incognito:false,tabs:t?[t]:[]}}const t=tab(nextId++,args.url,{windowId:8});tabs.push(t);tabEvents.onCreated.emit({...t});return{id:8,incognito:false,tabs:[t]}}},
 tabGroups:{...groupEvents,query:async()=>groups.slice(),update:async(id:number,changes:any)=>{calls.push(['group-update',id,changes]);return {}}},
 sessions:{onChanged:sessionEvent,getRecentlyClosed:async()=>[{lastModified:1,tab:{title:'Recently closed page',url:'https://closed.test/',sessionId:'recent'}}],restore:async(id:string)=>{calls.push(['restore',id])}},
 storage:{onChanged:storageEvent,local:{get:async(key:string)=>({[key]:data[key]}),set:async(value:any)=>{Object.assign(data,value);storageEvent.emit(Object.fromEntries(Object.keys(value).map(k=>[k,{newValue:value[k]}])),'local')}}}}
Object.defineProperty(globalThis,'chrome',{value:mock,configurable:true})
const {render,fireEvent,waitFor,cleanup,act,within}=await import('@testing-library/react')
const {default:TabSpace}=await import('../src/tabspace/TabSpace')
const props={active:true,onHome:()=>{},onSettings:()=>{}}
afterEach(()=>{cleanup();tabs=[tab(1,'https://a.test/?q=1#x',{active:true}),tab(2,'https://a.test/?q=1#x'),tab(3,'https://a.test/?q=1#y'),tab(4,'https://private.test/',{incognito:true})];groups=[];data={};calls=[];confirm=true;failId=null;queryCount=0;nextId=20;dom.window.localStorage.clear()})

test('gallery loads actual normal tabs, supports search and persists compact view',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Page 1'})))
 assert.ok(!ui.queryByRole('button',{name:'Page 4'}));assert.ok(ui.getByText('3 tabs shown · No screenshots captured'))
 fireEvent.click(ui.getByRole('button',{name:'Compact'}));await waitFor(()=>assert.equal(data['nova:tabspaceView'],'compact'));assert.equal(ui.getByRole('button',{name:'Compact'}).getAttribute('aria-pressed'),'true')
 fireEvent.change(ui.getByRole('textbox',{name:'Search tabs'}),{target:{value:'Page 3'}});await waitFor(()=>assert.ok(!ui.queryByRole('button',{name:'Page 1'})));assert.ok(ui.getByRole('button',{name:'Page 3'}))
})
test('close requires confirmation and tab menu calls real APIs',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Close Page 2'}));confirm=false;fireEvent.click(ui.getByRole('button',{name:'Close Page 2'}));assert.ok(!calls.some(x=>x[0]==='remove'))
 confirm=true;const card=ui.getByRole('button',{name:'Page 1'}).closest('article')!;fireEvent.click(ui.getByLabelText('Actions for Page 1'));fireEvent.click(within(card).getByRole('button',{name:'Pin tab'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='update'&&x[1]===1&&x[2].pinned)))
 fireEvent.click(within(card).getByRole('button',{name:'Duplicate tab'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='duplicate')))
 fireEvent.click(ui.getByRole('button',{name:'Close Page 2'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='remove'&&x[1]===2)));assert.ok(!ui.queryByRole('button',{name:'Page 2'}))
})
test('selection, grouping and failed bulk operations are reported',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('checkbox',{name:'Select Page 2'}));fireEvent.click(ui.getByRole('checkbox',{name:'Select Page 2'}));fireEvent.click(ui.getByRole('checkbox',{name:'Select Page 3'}));assert.ok(ui.getByText('2 selected'))
 fireEvent.click(ui.getByRole('button',{name:'Group…'}));fireEvent.change(ui.getByPlaceholderText('Name this group'),{target:{value:'Reading'}});fireEvent.click(ui.getByRole('button',{name:'Create group'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='group')))
 fireEvent.click(ui.getByRole('button',{name:/All tabs/}));failId=3;fireEvent.click(ui.getByRole('button',{name:'Close…'}));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/1 completed; 1 failed/));assert.ok(ui.getByText(/Page 3: Cannot close/))
})
test('cleanup matches query and fragment exactly and confirms closing',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));fireEvent.click(ui.getByRole('button',{name:/Clean up/}));assert.ok(ui.getByText('2 copies'));confirm=false;fireEvent.click(ui.getByRole('button',{name:'Close selected (1)'}));assert.ok(!calls.some(x=>x[0]==='remove'));confirm=true;fireEvent.click(ui.getByRole('button',{name:'Close selected (1)'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='remove'&&x[1]===2)));assert.ok(!calls.some(x=>x[0]==='remove'&&x[1]===3))
})
test('workspaces save descriptions without private tabs and restore selected into a new window',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));fireEvent.click(ui.getByRole('button',{name:'Workspaces'}));const name=ui.getByRole('textbox',{name:'Workspace name'}),description=ui.getByRole('textbox',{name:/Description/});fireEvent.change(name,{target:{value:'My desk'}});fireEvent.change(description,{target:{value:'Project notes'}});await waitFor(()=>assert.equal((ui.getByRole('button',{name:'Save current window'}) as HTMLButtonElement).disabled,false));fireEvent.click(ui.getByRole('button',{name:'Save current window'}));await waitFor(()=>assert.equal(data['nova:savedSessions']?.length,1));assert.equal(data['nova:savedSessions'][0].description,'Project notes');assert.equal(data['nova:savedSessions'][0].tabs.length,3)
 fireEvent.click(ui.getByRole('button',{name:'Preview'}));fireEvent.click(ui.getByRole('checkbox',{name:'Skip exact URLs already open'}));fireEvent.change(ui.getByRole('combobox',{name:'Destination'}),{target:{value:'new'}});fireEvent.click(ui.getByRole('button',{name:'Restore selected (3)'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='window-create'&&x[1].url)));assert.ok(ui.getByText(/Opened 3; skipped 0; 0 operation/))
})
test('listeners are removed while hidden and state refreshes on reentry',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));assert.equal(tabEvents.onUpdated.listeners.size,1);const previous=queryCount
 ui.rerender(createElement(TabSpace,{...props,active:false}));assert.equal(tabEvents.onUpdated.listeners.size,0);tabs=[tab(7,'https://new.test/')];ui.rerender(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 7'}));assert.ok(queryCount>previous);assert.ok(!ui.queryByRole('button',{name:'Page 1'}));ui.unmount();assert.equal(tabEvents.onUpdated.listeners.size,0);assert.equal(windowEvents.onCreated.listeners.size,0)
})
test('large lists render a bounded subset and external events update the snapshot',async()=>{
 tabs=Array.from({length:500},(_,i)=>tab(i+1,`https://site${i}.test/`));const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByText('500 tabs shown · No screenshots captured'));const viewport=ui.getByLabelText('Open tabs');assert.ok(within(viewport).getAllByRole('article').length<40)
 await act(async()=>{tabs.push(tab(999,'https://new.test/'));tabEvents.onCreated.emit(tabs[tabs.length-1])});assert.ok(ui.getByText('501 tabs shown · No screenshots captured'));assert.ok(within(viewport).getAllByRole('article').length<40)
})
test('group rename, color, collapse and ungroup use native APIs',async()=>{
 groups=[{id:9,windowId:1,title:'Reading',color:'blue',collapsed:false}];tabs[1].groupId=9
 Object.defineProperty(dom.window,'prompt',{value:()=> 'Renamed',configurable:true})
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));fireEvent.click(ui.getByRole('button',{name:'Groups'}));fireEvent.change(ui.getByRole('combobox',{name:'Color of Reading'}),{target:{value:'purple'}});fireEvent.click(ui.getByRole('button',{name:'Rename'}));fireEvent.click(ui.getByRole('button',{name:'Collapse'}));fireEvent.click(ui.getByRole('button',{name:'Ungroup all…'}))
 await waitFor(()=>assert.ok(calls.some(x=>x[0]==='ungroup'&&x[1][0]===2)));assert.ok(calls.some(x=>x[0]==='group-update'&&x[2].color==='purple'));assert.ok(calls.some(x=>x[0]==='group-update'&&x[2].title==='Renamed'));assert.ok(calls.some(x=>x[0]==='group-update'&&x[2].collapsed===true))
 Object.defineProperty(dom.window,'prompt',{value:()=>null,configurable:true})
})
test('dragging reorders only compatible tabs and drop into a group uses native grouping',async()=>{
 groups=[{id:9,windowId:1,title:'Reading',color:'blue',collapsed:false}];tabs[2].groupId=9
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));const transfer={value:'',effectAllowed:'',setData(_type:string,value:string){this.value=value},getData(){return this.value}}
 const first=ui.getByRole('button',{name:'Page 1'}).closest('article')!,second=ui.getByRole('button',{name:'Page 2'}).closest('article')!,third=ui.getByRole('button',{name:'Page 3'}).closest('article')!
 fireEvent.dragStart(first,{dataTransfer:transfer});fireEvent.drop(second,{dataTransfer:transfer});await waitFor(()=>assert.ok(calls.some(x=>x[0]==='move'&&x[1]===1)))
 calls=[];fireEvent.dragStart(first,{dataTransfer:transfer});fireEvent.drop(third,{dataTransfer:transfer});await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/within the same window/));assert.ok(!calls.some(x=>x[0]==='move'))
 fireEvent.dragStart(first,{dataTransfer:transfer});fireEvent.drop(ui.getByTitle(/Show Reading/),{dataTransfer:transfer});await waitFor(()=>assert.ok(calls.some(x=>x[0]==='group'&&x[1].groupId===9)))
})
test('recent recovery uses Chrome Sessions only after a user action',async()=>{
 const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));assert.ok(!calls.some(x=>x[0]==='restore'));fireEvent.click(ui.getByRole('button',{name:/Clean up/}));fireEvent.click(ui.getByRole('button',{name:'Restore'}));await waitFor(()=>assert.ok(calls.some(x=>x[0]==='restore'&&x[1]==='recent')))
})
test('a failed snapshot blocks tab actions until a successful retry',async()=>{
 const original=mock.tabs.query;let shouldFail=true;mock.tabs.query=async(args:any)=>{if(shouldFail)throw new Error('Snapshot unavailable');return original(args)}
 try{const ui=render(createElement(TabSpace,props));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/Snapshot unavailable/));assert.ok(!ui.queryByRole('button',{name:'Close Page 1'}));shouldFail=false;fireEvent.click(ui.getByRole('button',{name:'Retry'}));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}))}finally{mock.tabs.query=original}
})
test('view storage errors are visible and keyboard range selection works',async()=>{
 const original=mock.storage.local.set
 try{const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('checkbox',{name:'Select Page 1'}));fireEvent.click(ui.getByRole('checkbox',{name:'Select Page 1'}));fireEvent.click(ui.getByRole('checkbox',{name:'Select Page 3'}),{shiftKey:true});assert.ok(ui.getByText('3 selected'))
 mock.storage.local.set=async()=>{throw new Error('storage unavailable')};fireEvent.click(ui.getByRole('button',{name:'Compact'}));await waitFor(()=>assert.match(ui.getByRole('alert').textContent!,/could not be saved/))}finally{mock.storage.local.set=original}
})
test('rapid view changes are serialized so an older write cannot win',async()=>{
 const original=mock.storage.local.set;let release:()=>void=()=>{},started:()=>void=()=>{};const began=new Promise<void>(resolve=>{started=resolve});let first=true
 try{mock.storage.local.set=async(value:any)=>{if(first){first=false;started();await new Promise<void>(resolve=>{release=resolve})}await original(value)};const ui=render(createElement(TabSpace,props));await waitFor(()=>ui.getByRole('button',{name:'Page 1'}));fireEvent.click(ui.getByRole('button',{name:'Compact'}));fireEvent.click(ui.getByRole('button',{name:'Gallery'}));await began;await act(async()=>{release()});await waitFor(()=>assert.equal(data['nova:tabspaceView'],'gallery'));assert.equal(ui.getByRole('button',{name:'Gallery'}).getAttribute('aria-pressed'),'true')}finally{mock.storage.local.set=original}
})
