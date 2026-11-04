import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enableAutomatic, disableAutomatic, matchPattern, registrationId } from '../src/web/chrome'

test('denying optional site permission never registers a content script', async () => {
  const calls: any[] = []
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { permissions: { request: async (p: any) => { calls.push(p); return false } }, scripting: { registerContentScripts: () => { throw new Error('must not register') } } } })
  assert.equal(await enableAutomatic('https://example.com/*'), false)
  assert.deepEqual(calls, [{ origins: ['https://example.com/*'] }])
})

test('automatic styling requests and registers only the selected host, and can be revoked', async () => {
  const calls: Array<{type: string; value: any}> = []
  let registered = false
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    permissions: { request: async (p: any) => { calls.push({ type: 'request', value: p }); return true }, remove: async (p: any) => { calls.push({ type: 'remove', value: p }); return true } },
    scripting: { getRegisteredContentScripts: async () => registered ? [{ id: await registrationId('https://example.com/*') }] : [], registerContentScripts: async (items: any) => { registered = true; calls.push({ type: 'register', value: items }) }, unregisterContentScripts: async (p: any) => { calls.push({ type: 'unregister', value: p }); registered = false } },
  } })
  const pattern = matchPattern('https://example.com')!
  assert.equal(await enableAutomatic(pattern), true)
  assert.deepEqual(calls[0].value, { origins: ['https://example.com/*'] })
  assert.deepEqual(calls[1].value[0].matches, ['https://example.com/*'])
  assert.equal(calls[1].value[0].persistAcrossSessions, true)
  await disableAutomatic(pattern)
  assert.equal(calls.at(-1)?.type, 'remove')
  assert.deepEqual(calls.at(-1)?.value, { origins: ['https://example.com/*'] })
})

test('a failed script registration removes the newly requested permission', async () => {
  let removed = false
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    permissions: { request: async () => true, remove: async () => { removed = true; return true } },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => { throw new Error('registration failed') } },
  } })
  await assert.rejects(enableAutomatic('https://example.com/*'), /registration failed/)
  assert.equal(removed, true)
})
