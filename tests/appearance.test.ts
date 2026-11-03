import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PREFERENCES } from '../src/lib/defaults'
import { normalizePreferences } from '../src/lib/storage'
import { themeStyles } from '../src/lib/theme-engine'
import { MAX_WALLPAPER_SIZE, validateWallpaper } from '../src/lib/wallpaper'
import type { Theme } from '../src/lib/types'

test('each theme supplies a complete local token set', () => {
  for (const theme of ['midnight', 'dawn', 'aurora', 'custom'] as Theme[]) {
    const styles = themeStyles({ ...DEFAULT_PREFERENCES, theme }) as Record<string, string | number>
    for (const key of ['--bg', '--ink', '--muted', '--surface', '--border', '--button', '--accent']) assert.ok(styles[key], `${theme} missing ${key}`)
    assert.doesNotMatch(String(styles['--bg']), /https?:\/\//)
  }
  const custom = themeStyles({ ...DEFAULT_PREFERENCES, theme: 'custom', accentColor: '#123456' }) as Record<string, string>
  assert.equal(custom['--accent'], '#123456')
})

test('legacy settings migrate without hiding existing quick links', () => {
  const value = normalizePreferences({ layout: 'compact', animationIntensity: 'full', visibleWidgets: ['clock'], clockFormat: '24h' })
  assert.equal(value.layout, 'focus')
  assert.equal(value.spacing, 'compact')
  assert.equal(value.animationIntensity, 'expressive')
  assert.deepEqual(value.visibleWidgets, ['clock', 'shortcuts'])
  assert.equal(value.clockFormat, '24h')
})

test('invalid settings are bounded and shortcut order stays complete', () => {
  const value = normalizePreferences({ overlay: 999, brightness: -1, blur: NaN, shortcutOrder: ['GitHub', 'GitHub', 'invalid'] })
  assert.equal(value.overlay, 80)
  assert.equal(value.brightness, 40)
  assert.equal(value.blur, DEFAULT_PREFERENCES.blur)
  assert.deepEqual(value.shortcutOrder, ['GitHub', 'Google', 'YouTube', 'Gmail'])
})

test('wallpaper validation restricts file type and size', () => {
  assert.equal(validateWallpaper({ type: 'image/png', size: MAX_WALLPAPER_SIZE }), null)
  assert.ok(validateWallpaper({ type: 'image/svg+xml', size: 50 }))
  assert.ok(validateWallpaper({ type: 'image/jpeg', size: MAX_WALLPAPER_SIZE + 1 }))
  assert.ok(validateWallpaper({ type: 'image/webp', size: 0 }))
})

test('all background selections produce safe, local styles', () => {
  for (const background of ['theme', 'solid', 'mist', 'aurora', 'dunes', 'orbit', 'upload'] as const) {
    const styles = themeStyles({ ...DEFAULT_PREFERENCES, background }) as Record<string, string>
    assert.ok(styles['--bg'])
    assert.doesNotMatch(styles['--bg'], /https?:\/\//)
  }
})
