import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { safeUrl, duplicateKey, duplicates, saveableTabs, normalizeSession, isInactive } from '../src/command/model'
import { createGroup, addToGroup, closeDuplicates, restoreSaved, focusTab } from '../src/command/api'
import { getSessions, updateSessions } from '../src/command/storage'

const tab = (id: number, url: string, extra: Partial<chrome.tabs.Tab> = {}) => ({ id, url, title: `Tab ${id}`, windowId: 1, index: id, active: false, pinned: false, incognito: false, groupId: -1, highlighted: false, discarded: false, autoDiscardable: true, ...extra } as chrome.tabs.Tab)
const group = (id: number, title = 'Work') => ({ id, title, color: 'blue', collapsed: false, windowId: 1 } as chrome.tabGroups.TabGroup)
let tabs: chrome.tabs.Tab[], data: Record<string, any>, removed: number[], created: any[], grouped: any[], groupUpdates: any[], failSet: boolean
beforeEach(() => {
  tabs = []; data = {}; removed = []; created = []; grouped = []; groupUpdates = []; failSet = false
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    tabs: { query: async () => tabs, get: async (id: number) => { const t = tabs.find(t => t.id === id); if (!t) throw new Error('gone'); return t }, remove: async (ids: number | number[]) => { removed.push(...(Array.isArray(ids) ? ids : [ids])) }, update: async (id: number, props: any) => { created.push({ id, ...props }) }, group: async (props: any) => { grouped.push(props); return grouped.length + 40 }, create: async (props: any) => { if (props.url.includes('failure')) throw new Error('failed'); created.push(props); return { id: created.length + 100 } } },
    windows: { getCurrent: async () => ({ id: 1, incognito: false }), update: async (id: number, props: any) => { created.push({ windowId: id, ...props }) } },
    tabGroups: { update: async (id: number, props: any) => { groupUpdates.push({ id, ...props }) } },
    storage: { local: { get: async (key: string) => ({ [key]: data[key] }), set: async (value: any) => { if (failSet) throw new Error('quota'); Object.assign(data, value) } } },
  } })
})

test('safe URLs and duplicate normalization preserve queries, schemes and privacy', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null); assert.equal(safeUrl('https://user:pass@example.com/'), null); assert.equal(safeUrl('https://example.com/' + 'x'.repeat(4096)), null)
  assert.equal(duplicateKey('HTTPS://Example.COM:443/a?q=1#one'), 'https://example.com/a?q=1')
  assert.notEqual(duplicateKey('https://example.com/?x=1'), duplicateKey('https://example.com/?x=2'))
  assert.notEqual(duplicateKey('http://example.com/'), duplicateKey('https://example.com/'))
  const groups = duplicates([tab(1,'https://e.test/#a'), tab(2,'https://e.test/#b'), tab(3,'https://e.test/', { incognito: true }), tab(4,'https://e.test/', { incognito: true }), tab(5,'chrome://settings')])
  assert.deepEqual(groups.map(g => g.map(t => t.id)), [[1,2],[3,4]])
})

test('saving excludes private and unsupported tabs, retains pinned and distinct native group metadata', () => {
  const captured = saveableTabs([tab(1,'https://one.test/',{ groupId: 1 }), tab(2,'https://two.test/',{ groupId: 2 }), tab(3,'https://private.test/',{ incognito: true }), tab(4,'chrome://settings'), tab(5,'https://pinned.test/',{ pinned: true })], [group(1),group(2)])
  assert.equal(captured.skipped, 2); assert.equal(captured.tabs.length, 3); assert.equal(captured.tabs[0].groupName, 'Work'); assert.notEqual(captured.tabs[0].groupKey,captured.tabs[1].groupKey); assert.equal(captured.tabs[2].pinned,true)
  assert.equal(isInactive(tab(1,'https://e.test/',{ lastAccessed: 0 }), 31 * 60_000),true); assert.equal(isInactive(tab(1,'https://e.test/',{ active: true, lastAccessed: 0 }), 31 * 60_000),false)
})

test('workspace data validates structure and preserves unsupported stored URLs for safe skipping', () => {
  assert.equal(normalizeSession({ id:'', name:'bad' }), null)
  const result = normalizeSession({ id:'x', name:' Test ', createdAt:1, updatedAt:1, tabs:[{ url:'javascript:alert(1)', title:'x', groupName:'g', groupColor:'bogus' }] })!
  assert.equal(result.name,'Test'); assert.equal(result.tabs[0].url, 'javascript:alert(1)'); assert.equal(result.tabs[0].groupColor,undefined)
})

test('native grouping validates window and pinned constraints before API calls', async () => {
  await assert.rejects(createGroup([tab(1,'https://a.test/',{ pinned:true })], 'Work', 'blue'), /unpinned/)
  await assert.rejects(createGroup([tab(1,'https://a.test/'),tab(2,'https://b.test/',{ windowId:2 })], 'Work','blue'), /one window/)
  await assert.rejects(addToGroup([tab(2,'https://b.test/',{ windowId:2 })], group(1)), /same window/)
  assert.equal(grouped.length,0)
  await createGroup([tab(1,'https://a.test/'), tab(2,'https://b.test/')], 'Work','blue')
  assert.deepEqual(grouped[0], {tabIds:[1,2], createProperties:{windowId:1}}); assert.equal(groupUpdates[0].title,'Work')
  await addToGroup([tab(3,'https://c.test/')], group(1)); assert.equal(grouped[1].groupId,1)
})

test('duplicate closing rechecks original keep and candidates, excluding changed and private tabs', async () => {
  const original = [tab(1,'https://e.test/#one'),tab(2,'https://e.test/#two'),tab(3,'https://e.test/'),tab(4,'https://e.test/')]
  tabs = [original[0], original[1], tab(3,'https://other.test/'),tab(4,'https://e.test/',{incognito:true})]
  assert.equal(await closeDuplicates(original,1),1); assert.deepEqual(removed,[2])
  tabs = [tab(1,'https://other.test/'),tab(2,'https://other.test/')]
  await assert.rejects(closeDuplicates(original,1), /changed/); assert.deepEqual(removed,[2])
  await assert.rejects(closeDuplicates(original,99), /no longer available/)
})

test('restore skips already-open, repeated and unsafe URLs and recreates pinned and distinct groups', async () => {
  tabs = [tab(1,'https://already.test/#open'),tab(2,'https://private.test/',{incognito:true})]
  const result = await restoreSaved([{url:'https://already.test/#saved',title:'a'}, {url:'chrome://settings',title:'b'}, {url:'https://private.test/',title:'c',pinned:true}, {url:'https://a.test/',title:'d',groupName:'Work',groupKey:'1',groupColor:'blue'}, {url:'https://b.test/',title:'e',groupName:'Work',groupKey:'2',groupColor:'blue'}, {url:'https://b.test/#duplicate',title:'f'}, {url:'https://failure.test/',title:'g'}])
  assert.deepEqual(result,{opened:3,skipped:3,failed:1}); assert.equal(created[0].pinned,true); assert.equal(grouped.length,2); assert.equal(groupUpdates.length,2)
  assert.ok(created.every(item => item.active === false && item.windowId === 1))
})

test('restore refuses private window; focus uses Chrome APIs', async () => {
  ;(chrome.windows.getCurrent as any) = async () => ({id:1,incognito:true})
  await assert.rejects(restoreSaved([{url:'https://x.test/',title:'x'}]), /normal window/); assert.equal(created.length,0)
  await focusTab(tab(1,'https://x.test/')); assert.deepEqual(created, [{id:1,active:true},{windowId:1,focused:true}])
})

test('storage serializes writes and recovers from failed writes without overwriting malformed data', async () => {
  const item = (id: string) => ({id,name:id,createdAt:1,updatedAt:1,tabs:[]})
  await Promise.all([updateSessions(all => [...all,item('a')]), updateSessions(all => [...all,item('b')])]); assert.deepEqual((await getSessions()).map(x => x.id), ['a','b'])
  failSet = true; await assert.rejects(updateSessions(all => [...all,item('c')]), /quota/); failSet = false
  await updateSessions(all => [...all,item('d')]); assert.deepEqual((await getSessions()).map(x => x.id), ['a','b','d'])
  data['nova:savedSessions'] = 'broken'; await assert.rejects(getSessions(), /could not be read/); await assert.rejects(updateSessions(() => []), /no changes/); assert.equal(data['nova:savedSessions'],'broken')
})

test('restore reports group errors separately and allows another matching URL after a failed create', async () => {
  let attempt = 0
  ;(chrome.tabs.create as any) = async (props: any) => { attempt++; if (attempt === 1) throw new Error('temporary'); created.push(props); return { id: 9 } }
  ;(chrome.tabs.group as any) = async () => { throw new Error('group failed') }
  const result = await restoreSaved([{url:'https://retry.test/',title:'one'}, {url:'https://retry.test/#same',title:'two',groupName:'Study'}])
  assert.deepEqual(result,{opened:1,skipped:0,failed:2})
})

test('workspace size limit refuses the 51st session', async () => {
  const item = (id: string) => ({id,name:id,createdAt:1,updatedAt:1,tabs:[]})
  data['nova:savedSessions'] = Array.from({length:50},(_,i) => item(String(i)))
  await assert.rejects(updateSessions(all => [...all,item('51')]), /50 workspaces/)
  assert.equal(data['nova:savedSessions'].length,50)
})
