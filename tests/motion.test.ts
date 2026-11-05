import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'
import { DEFAULT_PREFERENCES } from '../src/lib/defaults'
import { motionLevel, subscribeToPreferences } from '../src/lib/motion'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/', pretendToBeVisual: true })
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
class EventMock { listeners = new Set<(...args: any[]) => void>(); addListener = (fn: (...args: any[]) => void) => { this.listeners.add(fn) }; removeListener = (fn: (...args: any[]) => void) => { this.listeners.delete(fn) }; emit = (...args: any[]) => { for (const fn of [...this.listeners]) fn(...args) } }
const storageEvents = new EventMock()
const stored: Record<string, unknown> = { preferences: { ...DEFAULT_PREFERENCES, animationIntensity: 'expressive', reducedMotion: false } }
const chromeMock = { storage: { local: { get: async (key: string) => ({ [key]: stored[key] }) }, onChanged: storageEvents } }
Object.defineProperty(globalThis, 'chrome', { value: chromeMock, configurable: true, writable: true })
const { render, waitFor, cleanup, act } = await import('@testing-library/react')
const { useMotionLevel } = await import('../src/lib/motion')

afterEach(() => { cleanup(); storageEvents.listeners.clear(); stored.preferences = { ...DEFAULT_PREFERENCES, animationIntensity: 'expressive', reducedMotion: false }; Object.defineProperty(globalThis, 'chrome', { value: chromeMock, configurable: true, writable: true }) })

test('every stored motion preference maps to exactly one data-motion level', () => {
  for (const animationIntensity of ['off', 'subtle', 'standard', 'expressive'] as const) {
    assert.equal(motionLevel({ animationIntensity, reducedMotion: false }), animationIntensity)
  }
  // A reduced-motion request always wins, whatever intensity was chosen earlier.
  for (const animationIntensity of ['subtle', 'standard', 'expressive'] as const) {
    assert.equal(motionLevel({ animationIntensity, reducedMotion: true }), 'off')
  }
})

test('preference listeners react to the stored preference key only and unsubscribe cleanly', () => {
  let calls = 0
  const stop = subscribeToPreferences(() => { calls++ })
  assert.equal(storageEvents.listeners.size, 1)
  storageEvents.emit({ preferences: { newValue: {} } }, 'local')
  assert.equal(calls, 1)
  // Unrelated keys and other storage areas must not reload preferences.
  storageEvents.emit({ shortcuts: { newValue: [] } }, 'local')
  storageEvents.emit({ preferences: { newValue: {} } }, 'sync')
  assert.equal(calls, 1)
  stop()
  stop()
  assert.equal(storageEvents.listeners.size, 0)
  storageEvents.emit({ preferences: { newValue: {} } }, 'local')
  assert.equal(calls, 1)
})

test('surfaces without a preferences object still follow live motion changes', async () => {
  function Probe() { return createElement('div', { 'data-motion': useMotionLevel() }) }
  const ui = render(createElement(Probe))
  await waitFor(() => assert.equal(ui.container.firstElementChild?.getAttribute('data-motion'), 'expressive'))
  await act(async () => { stored.preferences = { ...DEFAULT_PREFERENCES, reducedMotion: true }; storageEvents.emit({ preferences: { newValue: stored.preferences } }, 'local') })
  await waitFor(() => assert.equal(ui.container.firstElementChild?.getAttribute('data-motion'), 'off'))
  await act(async () => { stored.preferences = { ...DEFAULT_PREFERENCES, animationIntensity: 'off', reducedMotion: false }; storageEvents.emit({ preferences: { newValue: stored.preferences } }, 'local') })
  await waitFor(() => assert.equal(ui.container.firstElementChild?.getAttribute('data-motion'), 'off'))
  ui.unmount()
  assert.equal(storageEvents.listeners.size, 0)
})

test('a runtime without storage change events degrades to a no-op subscription', () => {
  Object.defineProperty(globalThis, 'chrome', { value: { storage: { local: { get: async () => ({}) } } }, configurable: true, writable: true })
  const stop = subscribeToPreferences(() => { throw new Error('must not be called') })
  assert.equal(typeof stop, 'function')
  stop()
})

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\s+/g, ' ')

test('the shared motion layer defines one timing scale, easing family and both off switches', () => {
  const css = read('src/motion.css')
  for (const token of ['--nova-ease', '--nova-ease-out', '--nova-t-fast', '--nova-t-base', '--nova-t-slow', '--nova-t-enter', '--nova-t-exit', '--nova-motion-scale', '--nova-rise']) {
    assert.ok(css.includes(token), `missing ${token}`)
  }
  assert.match(css, /\[data-motion="off"\] \*[^{]*\{[^}]*transition:none!important/)
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/)
  // The shortest and longest shared duration stay inside a snappy, accessible range.
  const ms = Number(/--nova-t-fast:calc\((\d+)ms/.exec(css)?.[1])
  const longest = Number(/--nova-t-enter:calc\((\d+)ms/.exec(css)?.[1])
  assert.ok(ms >= 60 && ms <= 140, `fast step ${ms}ms`)
  assert.ok(longest >= 200 && longest <= 360, `entrance step ${longest}ms`)
})

test('every extension page loads the motion layer and roots expose the shell to it', () => {
  for (const entry of ['src/main.tsx', 'src/command/main.tsx', 'src/automation/main.tsx', 'src/research/main.tsx', 'src/ai/main.tsx', 'src/popup/main.tsx', 'src/switcher/entry.tsx', 'src/tabspace/entry.tsx']) {
    assert.match(read(entry), /import '\.\.?\/motion\.css'/, `${entry} does not load the motion layer`)
  }
  assert.match(read('src/command/Command.tsx'), /className="command-shell" data-motion=\{motionLevel\(preferences\)\}/)
  assert.match(read('src/automation/Dashboard.tsx'), /className="automations" data-motion=\{motionLevel\(prefs\)\}/)
  assert.match(read('src/popup/popup.tsx'), /<main className="popup" data-motion=\{motion\}>/)
  const research = read('src/research/Research.tsx')
  assert.equal(research.match(/className="research-shell" data-motion=\{motionLevel\(prefs\)\}/g)?.length, 3)
  const assistant = read('src/ai/Assistant.tsx')
  assert.equal(assistant.match(/className="assistant" data-motion=\{motionLevel\(preferences\)\}/g)?.length, 2)
})

test('surface styles use shared tokens, avoid blanket transitions and keep streaming text still', () => {
  const surfaces = ['src/styles.css', 'src/switcher/switcher.css', 'src/tabspace/tabspace.css', 'src/command/command.css', 'src/automation/automations.css', 'src/research/research.css', 'src/ai/assistant.css', 'src/popup/popup.css']
  for (const file of surfaces) {
    const css = read(file)
    assert.ok(!/transition:\s*all/i.test(css), `${file} transitions every property`)
    assert.ok(!/scroll-behavior:\s*smooth/.test(css), `${file} forces smooth scrolling`)
    assert.ok(css.includes('var(--nova-t-'), `${file} does not use the shared motion tokens`)
    assert.match(css, /prefers-reduced-motion:|var\(--nova-motion-scale\)/, `${file} ignores reduced motion`)
  }
  // Assistant answers stream token by token: no animation or transition may target message bodies.
  const assistant = read('src/ai/assistant.css')
  assert.ok(!/\.ai-message>div[^{]*\{[^}]*animation:/.test(assistant))
  assert.ok(!/\.ai-messages[^{]*\{[^}]*animation:/.test(assistant))
  // Tab Space virtualises long lists, so rows must not animate layout or scroll position.
  const tabspace = read('src/tabspace/tabspace.css')
  assert.ok(!/\.ts-virtual-row[^{]*\{[^}]*animation:/.test(tabspace))
  assert.ok(!/scroll-behavior:\s*smooth/.test(tabspace))
})
