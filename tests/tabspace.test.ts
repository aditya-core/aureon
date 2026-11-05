import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exactDuplicates, exactKey, filterTabs, domainCollections, inactiveTabs } from '../src/tabspace/model'
import { closeExactDuplicates, applyTabs } from '../src/tabspace/operations'
import { normalizeSession } from '../src/command/model'
import { restoreSaved } from '../src/command/api'
const tab=(id:number,url:string,extra:Partial<chrome.tabs.Tab>={})=>({id,url,title:`Page ${id}`,windowId:1,index:id,active:false,pinned:false,incognito:false,groupId:-1,...extra} as chrome.tabs.Tab)
const setChrome=(value:unknown)=>Object.defineProperty(globalThis,'chrome',{configurable:true,value})

test('exact duplicate keys preserve queries and fragments and exclude private and credentialed URLs',()=>{
 const list=[tab(1,'https://a.test/?x=1#a'),tab(2,'https://a.test/?x=1#a'),tab(3,'https://a.test/?x=1#b'),tab(4,'https://a.test/?x=2#a'),tab(5,'https://a.test/?x=1#a',{incognito:true}),tab(6,'https://u:p@a.test/')]
 assert.deepEqual(exactDuplicates(list).map(g=>g.map(t=>t.id)),[[1,2]])
 assert.notEqual(exactKey(list[0].url),exactKey(list[2].url));assert.notEqual(exactKey(list[0].url),exactKey(list[3].url));assert.equal(exactKey(list[5].url),null)
})
test('search, filters, group names and sorts operate only on normal tabs',()=>{
 const groups=[{id:9,windowId:1,title:'Reading',color:'blue',collapsed:false} as chrome.tabGroups.TabGroup]
 const list=[tab(1,'https://z.test/',{title:'Zebra',groupId:9,pinned:true,lastAccessed:20}),tab(2,'https://a.test/',{title:'Apple',mutedInfo:{muted:true},lastAccessed:40}),tab(3,'https://z.test/',{incognito:true})]
 assert.deepEqual(filterTabs(list,groups,'reading','all','all','browser').map(t=>t.id),[1]);assert.deepEqual(filterTabs(list,groups,'','muted','all','browser').map(t=>t.id),[2]);assert.deepEqual(filterTabs(list,groups,'','all','all','alphabetical').map(t=>t.id),[2,1]);assert.deepEqual(filterTabs(list,groups,'','all','9','recent').map(t=>t.id),[1])
})
test('suggestions use exact hostnames and inactivity only with reliable timestamps',()=>{
 const now=2_000_000_000_000,week=7*24*60*60*1000
 const list=[tab(1,'https://github.com/a',{lastAccessed:now-week}),tab(2,'https://github.com/b'),tab(3,'https://sub.github.com/',{lastAccessed:0}),tab(4,'https://z.test/',{lastAccessed:now-week*2,active:true})]
 assert.deepEqual(domainCollections(list).map(d=>[d.domain,d.suggestion,d.tabs.length]),[['github.com','Development',2]]);assert.deepEqual(inactiveTabs(list,now).map(t=>t.id),[1])
})
test('descriptions are compatible with existing workspace records',()=>{
 const base={id:'workspace',name:'Saved',createdAt:1,updatedAt:2,tabs:[{url:'https://a.test/',title:'a'}]}
 assert.equal(normalizeSession(base)?.description,undefined);assert.equal(normalizeSession({...base,description:'x'.repeat(600)})?.description?.length,500)
})
test('exact duplicate closing rechecks every candidate and stops if the keep tab changes',async()=>{
 const list=[tab(1,'https://a.test/#one'),tab(2,'https://a.test/#one'),tab(3,'https://a.test/#one')], removed:number[]=[];let keepChecks=0
 setChrome({tabs:{get:async(id:number)=>{if(id===1){keepChecks++;return keepChecks>=3?tab(1,'https://a.test/#changed'):list[0]}return list.find(t=>t.id===id)},remove:async(id:number)=>{removed.push(id)}}})
 const result=await closeExactDuplicates(1,list);assert.deepEqual(removed,[2]);assert.equal(result.stopped,true);assert.equal(result.closed,1)
})
test('bulk operations report individual failures and never act on private tabs',async()=>{
 const list=[tab(1,'https://a.test/'),tab(2,'https://b.test/'),tab(3,'https://c.test/',{incognito:true})],acted:number[]=[]
 setChrome({tabs:{get:async(id:number)=>list.find(t=>t.id===id)}})
 const result=await applyTabs(list,async item=>{if(item.id===2)throw new Error('no permission');acted.push(item.id!)})
 assert.deepEqual(acted,[1]);assert.equal(result.completed,1);assert.equal(result.failures.length,2)
})
test('workspace restore supports exact skip and new windows, reports pin and grouping outcomes',async()=>{
 const created:any[]=[];let next=100
 setChrome({tabs:{query:async(args:any)=>args.windowId?[tab(100,'https://a.test/#other',{windowId:7})]:[tab(1,'https://a.test/#existing')],create:async(args:any)=>{created.push(args);return {id:++next}},update:async()=>{},group:async()=>44},windows:{getCurrent:async()=>({id:1,incognito:false}),create:async(args:any)=>{created.push(args);return {id:7,incognito:false,tabs:[{id:100}]}}},tabGroups:{update:async()=>{}}})
 const saved=[{title:'One',url:'https://a.test/#other',pinned:true},{title:'Two',url:'https://a.test/#existing'},{title:'Three',url:'https://b.test/',groupName:'Research',groupColor:'blue' as const}]
 const result=await restoreSaved(saved,{destination:'new',skipOpen:true,exact:true,includeDetails:true});assert.equal(result.opened,2);assert.equal(result.skipped,1);assert.equal(result.failed,0);assert.equal(created[0].url,'https://a.test/#other');assert.equal(created[1].windowId,7);assert.equal(result.details?.length,3)
})
test('workspace restore does not create more windows when destination is ambiguous',async()=>{
 let windows=0
 setChrome({tabs:{query:async()=>[]},windows:{getCurrent:async()=>({id:1,incognito:false}),create:async()=>{windows++;return {}}},tabGroups:{}})
 const result=await restoreSaved([{title:'One',url:'https://a.test/'},{title:'Two',url:'https://b.test/'}],{destination:'new',skipOpen:false,includeDetails:true})
 assert.equal(windows,1);assert.equal(result.failed,2);assert.match(result.details!.join(' '),/may have opened/)
})
