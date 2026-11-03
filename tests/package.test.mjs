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
  assert.deepEqual(manifest.permissions, ['storage'])
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
})
