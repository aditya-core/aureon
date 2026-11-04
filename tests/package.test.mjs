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
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'scripting', 'tabs', 'tabGroups', 'sessions', 'favicon', 'sidePanel'])
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*'])
  assert.equal(manifest.action?.default_popup, 'popup.html')
  await access(resolve(dist, manifest.action.default_popup))
  await access(resolve(dist, 'command.html'))
  assert.equal(manifest.side_panel?.default_path, 'sidepanel.html')
  await access(resolve(dist, 'sidepanel.html')); await access(resolve(dist, 'research.html'))
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
  assert.equal(manifest['command.html']?.isEntry, true)
  for (const key of ['sidepanel.html','research.html']) { assert.equal(manifest[key]?.isEntry, true); assert.ok(!staticImports.has(key), `${key} must not load on the new tab`) }
  assert.ok(!staticImports.has('command.html'), 'Command Centre must not load in the new-tab entry')
  assert.ok(!(manifest['popup.html'].imports ?? []).includes('command.html'), 'Command Centre must not load in the popup')
  const popupImports = new Set(manifest['popup.html'].imports ?? [])
  assert.ok(!popupImports.has('index.html'), 'popup must not eagerly load the new-tab entry')
  assert.ok(entry.dynamicImports.includes(settings))
  assert.ok(entry.dynamicImports.includes(workspace))
  for (const key of tools) assert.ok(manifest[settings].dynamicImports.includes(key), `${key} must be loaded on demand from settings`)
  const html = await read('index.html')
  for (const key of [settings, workspace, ...tools]) assert.ok(!html.includes(manifest[key].file), `${key} must not be preloaded in HTML`)
})


test('extension bundle does not include provider credentials or provider endpoint', async () => {
  const { readdir } = await import('node:fs/promises')
  for (const file of await readdir(resolve(dist, 'assets'))) {
    if (!file.endsWith('.js')) continue
    const source = await read(`assets/${file}`)
    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/, `possible provider key in ${file}`)
    assert.ok(!source.includes('NOVA_PROVIDER_KEY'), `server environment name leaked in ${file}`)
    assert.ok(!source.includes('api.openai.com'), `direct provider request in ${file}`)
  }
})
