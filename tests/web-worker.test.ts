import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'

function worker() {
  let listener: any
  const calls: Array<{method: string; args: any}> = []
  const data: Record<string, any> = {}
  const chrome = { runtime: { onMessage: { addListener: (fn: any) => { listener = fn } } },
    scripting: { insertCSS: async (args: any) => { calls.push({ method: 'insert', args }) }, removeCSS: async (args: any) => { calls.push({ method: 'remove', args }) } },
    tabs: { sendMessage: async (...args: any[]) => { calls.push({ method: 'send', args }); return { active: true } } },
    storage: { local: { get: async (key: string) => ({ [key]: data[key] }), set: async (values: any) => Object.assign(data, values) } },
  }
  vm.runInNewContext(readFileSync('public/background.js', 'utf8'), { chrome, URL, crypto: webcrypto })
  const sender = { tab: { id: 12, url: 'https://example.com/page' }, url: 'https://example.com/page', frameId: 0, documentId: 'document-1' }
  const send = (message: any, overrides = {}) => new Promise<any>(resolve => { if (listener(message, { ...sender, ...overrides }, resolve) !== true) resolve(undefined) })
  return { calls, data, send }
}

test('worker ignores protected, mismatched and subframe senders', async () => {
  const w = worker()
  await w.send({ type: 'NOVA_WEB_CSS', previous: '', css: 'body{}' }, { url: 'chrome://settings' })
  await w.send({ type: 'NOVA_WEB_CSS', previous: '', css: 'body{}' }, { url: 'https://other.example/' })
  await w.send({ type: 'NOVA_WEB_CSS', previous: '', css: 'body{}' }, { frameId: 2 })
  assert.equal(w.calls.length, 0)
})

test('worker removes and inserts document-scoped CSS without polling', async () => {
  const w = worker()
  assert.equal((await w.send({ type: 'NOVA_WEB_CSS', previous: 'old', css: 'new' })).ok, true)
  assert.deepEqual(w.calls.map(c => c.method), ['remove', 'insert'])
  assert.equal(w.calls[1].args.target.tabId, 12)
  assert.equal(w.calls[1].args.target.documentIds[0], 'document-1')
  assert.equal(w.calls[1].args.origin, 'USER')
})

test('worker accepts only safe selectors for enabled current-origin profiles', async () => {
  const w = worker()
  const key = 'nova:web:https://example.com'
  w.data[key] = { enabled: true, rules: [] }
  assert.equal((await w.send({ type: 'NOVA_WEB_ADD_RULE', selector: 'body' })).ok, false)
  assert.equal((await w.send({ type: 'NOVA_WEB_ADD_RULE', selector: 'div{display:none}' })).ok, false)
  assert.equal((await w.send({ type: 'NOVA_WEB_ADD_RULE', selector: 'aside:nth-of-type(1)' })).ok, true)
  assert.equal(w.data[key].rules[0].selector, 'aside:nth-of-type(1)')
  assert.equal(w.calls[0].method, 'send')
  assert.equal(w.calls[0].args[2].documentId, 'document-1')
})
