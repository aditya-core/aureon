import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Settings from '../src/components/settings/Settings'
import { DEFAULT_PREFERENCES } from '../src/lib/defaults'

test('settings renders its accessible dialog and theme options', () => {
  const html = renderToStaticMarkup(createElement(Settings, {
    preferences: DEFAULT_PREFERENCES,
    update: () => {}, status: 'saved', close: () => {},
    upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false,
  }))
  assert.match(html, /role="dialog"/)
  assert.match(html, /aria-modal="true"/)
  for (const label of ['Midnight', 'Dawn', 'Aurora', 'Custom', 'Changes saved locally']) assert.ok(html.includes(label), `missing ${label}`)
})
