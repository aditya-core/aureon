import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { getPages,getCollections,putPage,putCollection,removeCollection,searchPages,removePage } from '../src/research/db'
import type { SavedPage } from '../src/research/db'
const item=(id:string,url:string,collectionId:string|null=null):SavedPage=>({id,url,urlKey:'',title:`Page ${id}`,description:'Useful article',tags:['Science'],notes:'My private note',relatedIds:[],collectionId,createdAt:1,updatedAt:1})
test('research saves searchable pages, rejects duplicates and preserves collection deletion safely',async()=>{
  await putCollection({id:'c',name:' Research ',description:'Notes',createdAt:1});await putPage(item('1','https://example.test/a#one','c'))
  assert.equal((await getCollections())[0].name,'Research');assert.equal(searchPages(await getPages(),'private').length,1);assert.equal(searchPages(await getPages(),'science').length,1)
  await assert.rejects(putPage(item('2','https://example.test/a#two')));assert.equal((await getPages()).length,1)
  await removeCollection('c');assert.equal((await getCollections()).length,0);assert.equal((await getPages())[0].collectionId,null)
  await putPage({...item('linked','https://linked.test/'),relatedIds:['1']});await removePage('1');assert.deepEqual((await getPages())[0].relatedIds,[]);await removePage('linked');assert.equal((await getPages()).length,0)
})
test('research rejects unsafe URLs and supports distinct query strings',async()=>{
  await assert.rejects(putPage(item('x','javascript:alert(1)')),/HTTP/)
  await putPage(item('a','https://example.test/?q=1'));await putPage(item('b','https://example.test/?q=2'));assert.equal((await getPages()).length,2)
})
