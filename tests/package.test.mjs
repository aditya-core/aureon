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
  assert.equal(manifest.background?.service_worker, 'automation-worker.js')
  assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'scripting', 'tabs', 'tabGroups', 'sessions', 'favicon', 'sidePanel', 'alarms'])
  assert.deepEqual(manifest.optional_permissions, ['notifications'])
  assert.equal(manifest.commands['run-workflow'].suggested_key.default, 'Ctrl+Shift+Y')
  await access(resolve(dist, 'background.js')); await access(resolve(dist, 'automations.html')); await access(resolve(dist, 'automation-icon.png'))
  assert.match(await read('automation-worker.js'), /importScripts\(["']background\.js["']\)/)
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
  await access(resolve(dist, 'tabspace-horizon.jpg'))
})

test('studio, settings and workspace are outside the initial static bundle', async () => {
  const manifest = JSON.parse(await read('.vite/manifest.json'))
  const entry = manifest['index.html']
  assert.equal(entry?.isEntry, true)
  const settings = 'src/components/settings/Settings.tsx'
  const workspace = 'src/components/Workspace.tsx'
  const tabspace = 'src/tabspace/entry.tsx'
  const switcher = 'src/switcher/entry.tsx'
  const tools = ['AdvancedStudio', 'LayoutStudio', 'Profiles', 'Transfer'].map(name => `src/components/settings/${name}.tsx`)
  const staticImports = new Set()
  function visit(key) {
    assert.ok(manifest[key], `missing manifest chunk ${key}`)
    if (staticImports.has(key)) return
    staticImports.add(key)
    for (const dependency of manifest[key].imports ?? []) visit(dependency)
  }
  visit('index.html')
  for (const key of [settings, workspace, tabspace, switcher, ...tools]) {
    assert.equal(manifest[key]?.isDynamicEntry, true, `${key} must be a separate dynamic entry`)
    assert.ok(!staticImports.has(key), `${key} is eagerly loaded by the initial entry`)
    await access(resolve(dist, manifest[key].file))
  }
  assert.equal(manifest['popup.html']?.isEntry, true)
  assert.equal(manifest['command.html']?.isEntry, true)
  for (const key of ['sidepanel.html','research.html','automations.html']) { assert.equal(manifest[key]?.isEntry, true); assert.ok(!staticImports.has(key), `${key} must not load on the new tab`) }
  assert.ok(!staticImports.has('command.html'), 'Command Centre must not load in the new-tab entry')
  assert.ok(!(manifest['popup.html'].imports ?? []).includes('command.html'), 'Command Centre must not load in the popup')
  const popupImports = new Set(manifest['popup.html'].imports ?? [])
  assert.ok(!popupImports.has('index.html'), 'popup must not eagerly load the new-tab entry')
  assert.ok(entry.dynamicImports.includes(settings))
  assert.ok(entry.dynamicImports.includes(workspace))
  assert.ok(entry.dynamicImports.includes(tabspace))
  assert.ok(entry.dynamicImports.includes(switcher))
  for (const key of tools) assert.ok(manifest[settings].dynamicImports.includes(key), `${key} must be loaded on demand from settings`)
  const html = await read('index.html')
  for (const key of [settings, workspace, tabspace, switcher, ...tools]) assert.ok(!html.includes(manifest[key].file), `${key} must not be preloaded in HTML`)
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


test('workflow editor is loaded on demand from the Automations page', async () => {
  const manifest = JSON.parse(await read('.vite/manifest.json'))
  assert.equal(manifest['src/automation/WorkflowEditor.tsx']?.isDynamicEntry, true)
  assert.ok(manifest['automations.html'].dynamicImports.includes('src/automation/WorkflowEditor.tsx'))
})

test('every extension page loads the shared motion layer before its own styles', async () => {
  const pages = ['index.html', 'command.html', 'automations.html', 'research.html', 'sidepanel.html', 'popup.html']
  let shared = ''
  for (const page of pages) {
    const html = await read(page)
    const hrefs = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/gi)].map(match => match[1])
    assert.equal(hrefs.length, 2, `${page} should load the motion layer plus one page stylesheet`)
    const motion = hrefs[0]
    assert.match(motion, /(^|\/)motion-[^/]+\.css$/, `${page} does not load the shared motion layer first`)
    assert.ok(!/motion-/.test(hrefs[1]), `${page} loads motion styles twice`)
    if (shared) assert.equal(motion, shared, 'pages should share one motion stylesheet')
    shared = motion
    await access(resolve(dist, motion.replace(/^\.\//, '')))
  }
  const css = await read(shared.replace(/^\.\//, ''))
  assert.match(css, /--nova-motion-scale:1/)
  assert.match(css, /--nova-t-fast:calc\(\.1s \* var\(--nova-motion-scale\)\)/)
  assert.match(css, /\[data-motion=off\]/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.ok(!/transition:all/.test(css), 'the motion layer must not blanket-transition every property')
})
