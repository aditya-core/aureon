import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES } from '../src/lib/defaults'
import { getNotes, getPreferences, getShortcuts, getInitialShortcuts, normalizePreferences, resetPreferences, saveNotes, savePreferences, saveShortcuts } from '../src/lib/storage'

const data: Record<string, unknown> = {}
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { storage: { local: {
  get: async (key: string) => ({ [key]: data[key] }),
  set: async (values: Record<string, unknown>) => { Object.assign(data, values) },
} } } })

test('missing and malformed preferences safely fall back to defaults', async () => {
  assert.deepEqual(await getPreferences(), DEFAULT_PREFERENCES)
  assert.deepEqual(normalizePreferences({ theme: 'nope', clockFormat: '24h', visibleWidgets: ['clock', 'bogus'], greetingEnabled: 'false' }), {
    ...DEFAULT_PREFERENCES, clockFormat: '24h', visibleWidgets: ['clock'],
  })
  assert.deepEqual(await getShortcuts(), [])
})

test('preferences, notes and shortcuts persist and reset affects preferences only', async () => {
  const preferences = { ...DEFAULT_PREFERENCES, clockFormat: '24h' as const, theme: 'aurora' as const, layout: 'workspace' as const, visibleWidgets: ['clock', 'shortcuts', 'notes', 'tasks'] as typeof DEFAULT_PREFERENCES.visibleWidgets }
  const notes = [{ id: '1', title: 'Note', content: 'hello', createdAt: 'now', updatedAt: 'now' }]
  const shortcuts = [{ id: '1', title: 'Example', url: 'https://example.com/', icon: null, position: 0 }]
  await savePreferences(preferences)
  await saveNotes(notes)
  await saveShortcuts(shortcuts)
  assert.deepEqual(await getPreferences(), preferences)
  assert.deepEqual(await getNotes(), notes)
  assert.deepEqual(await getShortcuts(), shortcuts)
  await resetPreferences()
  assert.deepEqual(await getPreferences(), DEFAULT_PREFERENCES)
  assert.deepEqual(await getNotes(), notes)
  assert.deepEqual(await getShortcuts(), shortcuts)
})

test('storage errors propagate to callers rather than silently discarding writes', async () => {
  const local = chrome.storage.local
  const original = local.set
  local.set = (() => Promise.reject(new Error('storage unavailable'))) as typeof local.set
  try { await assert.rejects(savePreferences(DEFAULT_PREFERENCES), /storage unavailable/) }
  finally { local.set = original }
})


test('starter links respect old order and an intentionally empty saved list stays empty', async () => {
  delete data.shortcuts
  const starters = await getInitialShortcuts(['GitHub', 'Google', 'YouTube', 'Gmail'])
  assert.deepEqual(starters.map(item => item.title), ['GitHub', 'Google', 'YouTube', 'Gmail'])
  await saveShortcuts([])
  assert.deepEqual(await getInitialShortcuts(['GitHub', 'Google', 'YouTube', 'Gmail']), [])
})

test('malformed productivity items do not crash list loading', async () => {
  data.notes = [null, { id: 3 }, { id: 'n', title: 'Safe', content: 'text', createdAt: 'x', updatedAt: 'x' }]
  data.shortcuts = [null, { id: 'x', title: 'Bad', url: 'javascript:alert(1)', position: 0 }]
  assert.equal((await getNotes()).length, 1)
  assert.deepEqual(await getShortcuts(), [])
})
