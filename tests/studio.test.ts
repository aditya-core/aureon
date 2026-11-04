import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES } from '../src/lib/defaults'
import { contrastRatio } from '../src/lib/color'
import { captureCustomization, exportCustomization, parseCustomization } from '../src/lib/studio'
import { normalizePreferences } from '../src/lib/storage'
import { getProfiles, saveProfiles, starterProfiles } from '../src/lib/profiles'

const data: Record<string, unknown> = {}
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { storage: { local: {
  get: async (key: string) => ({ [key]: data[key] }),
  set: async (values: Record<string, unknown>) => { Object.assign(data, values) },
} } } })

test('customization exports round-trip without personal data or wallpaper bytes', () => {
  const preferences = { ...DEFAULT_PREFERENCES, theme: 'custom' as const, displayName: 'Private name', wallpaper: 'secret legacy bytes', customTextColor: '#efefef', sectionOrder: ['search','clock','shortcuts','widgets'] as typeof DEFAULT_PREFERENCES.sectionOrder }
  const json = exportCustomization(preferences)
  assert.doesNotMatch(json, /Private name|secret legacy bytes|displayName|"wallpaper"/)
  assert.deepEqual(parseCustomization(JSON.parse(json)), captureCustomization(preferences))
})

test('imports reject wrong versions, unknown fields, malformed colors and invalid layout', () => {
  const valid = JSON.parse(exportCustomization(DEFAULT_PREFERENCES))
  for (const invalid of [null, { ...valid, version: 2 }, { ...valid, secret: 1 }, { ...valid, customization: { ...valid.customization, customTextColor: 'red; color:black' } }, { ...valid, customization: { ...valid.customization, gradientAngle: 999 } }, { ...valid, customization: { ...valid.customization, widgetSizes: { notes: 'wide' } } }, { ...valid, customization: { ...valid.customization, sectionOrder: ['clock', 'clock', 'search', 'widgets'] } }]) assert.throws(() => parseCustomization(invalid))
  const injected = JSON.parse(exportCustomization(DEFAULT_PREFERENCES))
  injected.customization.__proto__ = { polluted: true }
  // JSON-supplied prototype-looking keys are not on the allowlist.
  const malicious = JSON.parse(exportCustomization(DEFAULT_PREFERENCES).replace('"theme":', '"__proto__": {"polluted":true}, "theme":'))
  assert.throws(() => parseCustomization(malicious))
  assert.equal(({} as {polluted?: boolean}).polluted, undefined)
})

test('old settings gain safe studio defaults without dropping preferences', () => {
  const p = normalizePreferences({ theme: 'dawn', layout: 'workspace', widgetOrder: ['tasks', 'notes', 'focus'] })
  assert.equal(p.theme, 'dawn')
  assert.deepEqual(p.sectionOrder, ['clock', 'search', 'shortcuts', 'widgets'])
  assert.deepEqual(p.widgetSizes, { notes: 'normal', tasks: 'normal', focus: 'normal' })
  assert.deepEqual(p.widgetOrder, ['tasks', 'notes', 'focus'])
})

test('contrast calculation is deterministic', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21)
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1)
})

test('profiles persist independently and malformed stored profiles are not silently overwritten', async () => {
  const defaults = await getProfiles()
  assert.deepEqual(defaults.map(p => p.name), ['Work', 'Study', 'Personal'])
  const custom = [...starterProfiles(), { id: 'custom', name: 'Evening', customization: captureCustomization({ ...DEFAULT_PREFERENCES, theme: 'aurora' }) }]
  await saveProfiles(custom)
  assert.deepEqual(await getProfiles(), custom)
  assert.equal(data.preferences, undefined)
  data.profiles = [{ id: 'broken', name: 'Broken', customization: {} }]
  await assert.rejects(getProfiles())
  assert.deepEqual(data.profiles, [{ id: 'broken', name: 'Broken', customization: {} }])
})

test('low contrast custom colors leave the settings panel with readable fallback ink', async () => {
  const { themeStyles } = await import('../src/lib/theme-engine')
  const style = themeStyles({ ...DEFAULT_PREFERENCES, theme: 'custom', customTextColor: '#000000', customSurfaceColor: '#000000', accentColor: '#000000' }) as Record<string, string>
  assert.equal(style['--ink'], '#000000')
  assert.equal(style['--panel-ink'], '#ffffff')
  assert.equal(style['--panel-accent'], '#ffffff')
})

test('profile save failures propagate instead of pretending success', async () => {
  const local = chrome.storage.local
  const original = local.set
  local.set = (() => Promise.reject(new Error('quota exceeded'))) as typeof local.set
  try { await assert.rejects(saveProfiles(starterProfiles()), /quota exceeded/) } finally { local.set = original }
})

test('a missing uploaded wallpaper falls back to the selected custom gradient', async () => {
  const { themeStyles } = await import('../src/lib/theme-engine')
  const preferences = { ...DEFAULT_PREFERENCES, theme: 'custom' as const, background: 'upload' as const, gradientAngle: 90, gradientStart: '#111111', gradientEnd: '#eeeeee' }
  const style = themeStyles(preferences) as Record<string, string>
  assert.equal(style['--bg'], 'linear-gradient(90deg, #111111, #eeeeee)')
})
