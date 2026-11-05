import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { getPages, getCollections, importResearchBackup, putCollection, putPage } from '../src/research/db'
import { createResearchBackup, parseResearchBackup, MAX_BACKUP_BYTES } from '../src/research/transfer'
import type { Collection, SavedPage } from '../src/research/db'
const collection = (id:string):Collection => ({id,name:'Research',description:'',createdAt:1})
const page = (id:string,url:string,overrides:Partial<SavedPage>={}):SavedPage => ({id,url,urlKey:'ignored',title:id,description:'',tags:['tag'],notes:'private note',relatedIds:[],collectionId:null,createdAt:1,updatedAt:1,...overrides})

test('backup round-trips notes, collections, relationships and cards without secrets or URL loss',()=>{
  const data=createResearchBackup([collection('c')],[page('a','https://example.test/?q=1',{collectionId:'c',relatedIds:['b'],card:{summary:'A summary',takeaways:['One',''],tags:['topic',''],generatedAt:2}}),page('b','https://other.test/')])
  const result=parseResearchBackup(data);assert.equal(result.pages[0].notes,'private note');assert.deepEqual(result.pages[0].relatedIds,['b']);assert.equal(result.pages[0].card?.summary,'A summary');assert.equal(result.pages[0].url,'https://example.test/?q=1');assert.ok(!data.includes('nova:aiConnection'))
  const extra = createResearchBackup([], [{...page('s','https://safe.test/'), hiddenSecret:'do-not-export'} as any]);assert.ok(!extra.includes('do-not-export'))
})
test('import merges atomically, skips duplicate URLs, remaps colliding IDs and never overwrites existing pages',async()=>{
  await putCollection(collection('existing'));await putPage(page('conflict','https://existing.test/',{title:'Existing title'}))
  const backup=parseResearchBackup(createResearchBackup([collection('new')],[page('duplicate','https://existing.test/#anchor'),page('conflict','https://new.test/',{collectionId:'new',relatedIds:['duplicate']})]))
  const result=await importResearchBackup(backup)
  assert.deepEqual(result,{collections:1,pages:1,skipped:1})
  const pages=await getPages(), existing=pages.find(p=>p.url==='https://existing.test/')!, imported=pages.find(p=>p.url==='https://new.test/')!
  assert.equal(existing.title,'Existing title');assert.notEqual(imported.id,'conflict');assert.deepEqual(imported.relatedIds,['conflict']);assert.equal(imported.collectionId,'new');assert.equal((await getCollections()).length,2)
  const again=await importResearchBackup(backup);assert.deepEqual(again,{collections:0,pages:0,skipped:2});assert.equal((await getPages()).length,2)
})
test('invalid, malicious, oversized and unsupported backups leave existing data untouched',async()=>{
  const before=(await getPages()).length
  const orphan = parseResearchBackup(createResearchBackup([], [page('orphan','https://orphan.test/',{collectionId:'missing'})]));await importResearchBackup(orphan);assert.equal((await getPages()).find(p=>p.id==='orphan')?.collectionId,null)
  const afterOrphan=(await getPages()).length
  assert.throws(()=>parseResearchBackup('{bad'),/valid JSON/)
  assert.throws(()=>parseResearchBackup('x'.repeat(MAX_BACKUP_BYTES+1)),/larger than 5 MB/)
  const invalid={format:'nova-research',version:1,exportedAt:1,collections:[],pages:[page('evil','javascript:alert(1)')]}
  assert.throws(()=>parseResearchBackup(JSON.stringify(invalid)),/invalid/)
  await assert.rejects(importResearchBackup(invalid as any),/invalid/)
  assert.equal(afterOrphan,before+1);assert.equal((await getPages()).length,afterOrphan)
})

test('a write constraint failure rolls the whole import transaction back',async()=>{
  const beforePages=await getPages(), beforeCollections=await getCollections()
  const backup=parseResearchBackup(createResearchBackup([collection('rollback-collection')],[page('abort-page','https://rollback.test/',{collectionId:'rollback-collection'})]))
  const original=IDBObjectStore.prototype.add
  IDBObjectStore.prototype.add=function(value: any, key?: IDBValidKey) {
    // Simulate an IndexedDB write error after the collection was queued.
    return original.call(this, this.name==='pages' && value.id==='abort-page' ? {...value,id:'conflict'} : value, key)
  }
  try { await assert.rejects(importResearchBackup(backup)) } finally { IDBObjectStore.prototype.add=original }
  assert.deepEqual(await getPages(),beforePages);assert.deepEqual(await getCollections(),beforeCollections)
})
