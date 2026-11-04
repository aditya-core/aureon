import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FOCUS, formatRemaining, normalizeFocus, reconcileFocus, remainingFocus } from '../src/lib/focus'
import { validateShortcutUrl } from '../src/lib/shortcuts'
import { normalizePreferences } from '../src/lib/storage'

test('shortcut URL validation only permits web addresses without credentials', () => {
  assert.equal(validateShortcutUrl('example.com/path'), 'https://example.com/path')
  assert.equal(validateShortcutUrl('http://localhost:3000'), 'http://localhost:3000/')
  for (const input of ['javascript:alert(1)', 'file:///etc/passwd', 'https://a:b@example.com', 'not a site', '']) assert.equal(validateShortcutUrl(input), null)
})

test('clock preferences and widget order normalize safely', () => {
  const p = normalizePreferences({ showSeconds: true, displayName: 'Nova', widgetOrder: ['focus','notes','focus','unknown'] })
  assert.equal(p.showSeconds, true)
  assert.equal(p.displayName, 'Nova')
  assert.deepEqual(p.widgetOrder, ['focus','notes','tasks'])
})

test('focus uses timestamps and reconciles a completed session only once', () => {
  const started = { ...DEFAULT_FOCUS, endsAt: 100_000, remainingMs: 25 * 60_000 }
  assert.equal(remainingFocus(started, 99_000), 1000)
  assert.equal(formatRemaining(1001), '00:02')
  const finished = reconcileFocus(started, 200_000)
  assert.equal(finished.remainingMs, 0)
  assert.equal(finished.sessions, 1)
  assert.equal(finished.completed, true)
  assert.deepEqual(reconcileFocus(finished, 300_000), finished)
  const breakState = reconcileFocus({ ...started, mode: 'short' }, 200_000)
  assert.equal(breakState.sessions, 0)
})

test('focus recovery clamps malformed durations and state', () => {
  const state = normalizeFocus({ mode: 'long', durations: { focus: 999, short: -5, long: 10 }, endsAt: 'bad', sessions: -1 })
  assert.deepEqual(state.durations, { focus: 180, short: 1, long: 10 })
  assert.equal(state.remainingMs, 600_000)
  assert.equal(state.endsAt, null)
  assert.equal(state.sessions, 0)
})
