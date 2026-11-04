import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { resolve, dirname, sep } from 'node:path'

const dist = resolve('dist')
const read = path => readFile(resolve(dist, path), 'utf8')

// These are packaging checks, not a substitute for loading the extension in Chrome.
test('built MV3 manifest contains the intended new-tab entry and minimal permissions', async () => {
  const manifest = JSON.parse(await read('manifest.json'))
  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.chrome_url_overrides?.newtab, 'index.html')
  assert.equal(manifest.background?.service_worker, 'background.js')
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'scripting'])
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*'])
  assert.equal(manifest.action?.default_popup, 'popup.html')
  await access(resolve(dist, manifest.action.default_popup))
  for (const asset of ['web/model.js', 'web/appearance.js', 'web/reader.js', 'web/reader.css', 'web/picker.js']) await access(resolve(dist, asset))
  assert.equal(manifest.host_permissions, undefined)
  assert.equal(manifest.content_scripts, undefined)
  await access(resolve(dist, manifest.chrome_url_overrides.newtab))
  await access(resolve(dist, manifest.background.service_worker))
})

test('built new-tab HTML references present, local script and stylesheet assets', async () => {
  const html = await read('index.html')
  const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/i)?.[1]
  const stylesheet = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"/i)?.[1]
  assert.ok(script, 'missing script asset')
  assert.ok(stylesheet, 'missing stylesheet asset')
  for (const asset of [script, stylesheet]) {
    assert.ok(asset.startsWith('./'), `asset must be relative: ${asset}`)
    const path = resolve(dirname(resolve(dist, 'index.html')), asset)
    assert.ok(path.startsWith(dist + sep), `asset must be inside dist: ${asset}`)
    await access(path)
  }
})

test('bundled wallpaper presets are included in the build', async () => {
  await access(resolve(dist, 'wallpapers/dunes.svg'))
  await access(resolve(dist, 'wallpapers/orbit.svg'))
  await access(resolve(dist, 'wallpapers/horizon.svg'))
  await access(resolve(dist, 'wallpapers/grove.svg'))
})

test('studio, settings and workspace are outside the initial static bundle', async () => {
  const manifest = JSON.parse(await read('.vite/manifest.json'))
  const entry = manifest['index.html']
  assert.equal(entry?.isEntry, true)
  const settings = 'src/components/settings/Settings.tsx'
  const workspace = 'src/components/Workspace.tsx'
  const tools = ['AdvancedStudio', 'LayoutStudio', 'Profiles', 'Transfer'].map(name => `src/components/settings/${name}.tsx`)
  const staticImports = new Set()
  function visit(key) {
    assert.ok(manifest[key], `missing manifest chunk ${key}`)
    if (staticImports.has(key)) return
    staticImports.add(key)
    for (const dependency of manifest[key].imports ?? []) visit(dependency)
  }
  visit('index.html')
  for (const key of [settings, workspace, ...tools]) {
    assert.equal(manifest[key]?.isDynamicEntry, true, `${key} must be a separate dynamic entry`)
    assert.ok(!staticImports.has(key), `${key} is eagerly loaded by the initial entry`)
    await access(resolve(dist, manifest[key].file))
  }
  assert.equal(manifest['popup.html']?.isEntry, true)
  const popupImports = new Set(manifest['popup.html'].imports ?? [])
  assert.ok(!popupImports.has('index.html'), 'popup must not eagerly load the new-tab entry')
  assert.ok(entry.dynamicImports.includes(settings))
  assert.ok(entry.dynamicImports.includes(workspace))
  for (const key of tools) assert.ok(manifest[settings].dynamicImports.includes(key), `${key} must be loaded on demand from settings`)
  const html = await read('index.html')
  for (const key of [settings, workspace, ...tools]) assert.ok(!html.includes(manifest[key].file), `${key} must not be preloaded in HTML`)
})
