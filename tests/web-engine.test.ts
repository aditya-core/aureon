import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { matchPattern, registrationId } from '../src/web/chrome'

const modelSource = readFileSync('public/web/model.js', 'utf8')
const readerSource = readFileSync('public/web/reader.js', 'utf8')
const pickerSource = readFileSync('public/web/picker.js', 'utf8')
const appearanceSource = readFileSync('public/web/appearance.js', 'utf8')
function setup(html = '<html><body></body></html>', url = 'https://example.com/article') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true })
  const listeners: Array<(message: any, sender: any, reply: (value: any) => void) => boolean> = []
  const messages: any[] = []
  const saved: Record<string, any> = {}
  Object.defineProperty(dom.window, 'chrome', { configurable: true, value: { runtime: {
    onMessage: { addListener: (fn: typeof listeners[number]) => listeners.push(fn) },
    sendMessage: async (msg: any) => { messages.push(msg); return { ok: true } },
  }, storage: { local: { get: async (key: string) => ({ [key]: saved[key] }), set: async (data: any) => Object.assign(saved, data) } } } })
  const run = (source: string) => vm.runInContext(source, dom.getInternalVMContext())
  run(modelSource)
  const model = (dom.window as any).NovaWebModel
  const send = (message: any) => new Promise<any>(resolve => { for (const listener of listeners) if (listener(message, {}, resolve) === true) return; resolve(undefined) })
  return { dom, model, run, send, messages, saved }
}

test('website profiles are bounded and never accept arbitrary CSS or unsafe selectors', () => {
  const { dom, model } = setup()
  const p = model.normalize({ enabled: true, dark: { enabled: true, text: '#fff;}', background: '#000000' }, typography: { enabled: true, font: 'url(https://evil)', size: 999 }, rules: [{ id: 'x', selector: 'div{color:red}' }, { id: 'y', selector: 'div#sidebar' }] })
  assert.equal(p.dark.text, '#e8eaf1')
  assert.equal(p.typography.size, 30)
  assert.equal(p.typography.font, 'system')
  assert.equal(p.rules.length, 1)
  assert.equal(model.validSelector('button'), false)
  assert.equal(model.validSelector('div:nth-of-type(2) > aside:nth-of-type(1)'), true)
  assert.equal(model.validSelector('div, body'), false)
  const css = model.buildCSS(p, 'example.com')
  assert.match(css, /div#sidebar\{display:none/)
  assert.doesNotMatch(css, /invert\(|url\(|video\s*\{|img\s*\{/)
  assert.equal(model.buildCSS({ ...p, enabled: false }), '')
  assert.doesNotMatch(model.buildCSS({ ...p, distractions: false }), /div#sidebar/)
  dom.window.close()
})

test('only HTTP(S) origins can be used and automatic match patterns never silently widen ports', async () => {
  const { dom, model } = setup()
  assert.equal(model.originOf('chrome://settings'), null)
  assert.equal(model.originOf('https://example.com/private?q=secret'), 'https://example.com')
  assert.equal(matchPattern('https://example.com'), 'https://example.com/*')
  assert.equal(matchPattern('http://localhost:3000'), null)
  assert.notEqual(await registrationId('https://a.example/*'), await registrationId('https://b.example/*'))
  dom.window.close()
})

test('appearance can apply and remove CSS without touching page content', async () => {
  const { dom, model, run, send, messages } = setup('<html><body><main><p>Original article</p><img src="local.png"></main></body></html>')
  run(appearanceSource)
  const p = model.normalize({ enabled: true, dark: { enabled: true } })
  assert.equal((await send({ type: 'NOVA_WEB_SET', profile: p })).active, true)
  assert.equal((await send({ type: 'NOVA_WEB_SET', profile: { ...p, enabled: false } })).active, false)
  const cssMessages = messages.filter(m => m.type === 'NOVA_WEB_CSS')
  assert.equal(cssMessages.length, 2)
  assert.equal(cssMessages[1].previous, cssMessages[0].css)
  assert.equal(cssMessages[1].css, '')
  assert.equal(dom.window.document.querySelector('main p')?.textContent, 'Original article')
  assert.ok(dom.window.document.querySelector('img'))
  dom.window.close()
})

test('reader sanitizes extracted article, preserves safe links, and exits without altering the original', async () => {
  const longText = 'A readable paragraph with useful details. '.repeat(10)
  const html = `<html><body><article><h1>Research title</h1><p>${longText}</p><script>danger()</script><p><a href="javascript:alert(1)">bad link</a><a href="/safe">safe link</a></p><ul><li>Useful item</li></ul><img src="https://example.org/pixel"><form><input></form></article></body></html>`
  const { dom, run, send, messages } = setup(html)
  run(readerSource)
  assert.equal((await send({ type: 'NOVA_WEB_READER', options: { theme: 'warm' } })).open, true)
  const reader = dom.window.document.querySelector('#nova-web-reader-root')!
  assert.ok(reader.textContent?.includes('Research title'))
  assert.ok(reader.querySelector('li'))
  assert.equal(reader.querySelector('script,img,form,input:not([type=number])'), null)
  assert.equal(reader.querySelector('a')?.getAttribute('href'), null)
  assert.equal(reader.querySelectorAll('a')[1].getAttribute('href'), 'https://example.com/safe')
  assert.equal((await send({ type: 'NOVA_WEB_READER', options: {} })).open, false)
  assert.equal(dom.window.document.querySelector('#nova-web-reader-root'), null)
  assert.ok(dom.window.document.querySelector('article img'))
  assert.deepEqual(messages.filter(m => m.type === 'NOVA_WEB_READER_CSS').map(m => m.enable), [true, false])
  dom.window.close()
})

test('reader returns a graceful error on unsupported pages', async () => {
  const { dom, run, send } = setup('<html><body><p>Short page</p></body></html>')
  run(readerSource)
  assert.match((await send({ type: 'NOVA_WEB_READER', options: {} })).error, /No supported article/)
  assert.equal(dom.window.document.querySelector('#nova-web-reader-root'), null)
  dom.window.close()
})

test('picker selects inside main but refuses interactive controls and cleans up', async () => {
  const { dom, run, messages } = setup('<html><body><main><div><aside>Promoted content</aside><button>Important control</button></div></main></body></html>')
  run(pickerSource)
  const button = dom.window.document.querySelector('button')!
  button.dispatchEvent(new dom.window.MouseEvent('mousemove', { bubbles: true }))
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert.equal(messages.filter(m => m.type === 'NOVA_WEB_ADD_RULE').length, 0)
  ;(dom.window as any).NovaWebPicker.start()
  const aside = dom.window.document.querySelector('aside')!
  aside.dispatchEvent(new dom.window.MouseEvent('mousemove', { bubbles: true }))
  aside.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await Promise.resolve()
  assert.equal(messages.filter(m => m.type === 'NOVA_WEB_ADD_RULE').length, 1)
  assert.match(messages.find(m => m.type === 'NOVA_WEB_ADD_RULE').selector, /aside/)
  dom.window.close()
})

test('an old automatic profile read cannot override an explicit disable', async () => {
  const { dom, model, run, send, messages } = setup()
  let resolveRead!: (value: any) => void
  ;(dom.window as any).chrome.storage.local.get = () => new Promise(resolve => { resolveRead = resolve })
  run(appearanceSource)
  const old = model.normalize({ enabled: true, auto: true, dark: { enabled: true } })
  await send({ type: 'NOVA_WEB_SET', profile: { ...old, enabled: false } })
  resolveRead({ 'nova:web:https://example.com': old })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(messages.filter(m => m.type === 'NOVA_WEB_CSS').length, 0)
  dom.window.close()
})

test('picker asks before hiding a container with interactive controls', async () => {
  const { dom, run, messages } = setup('<html><body><article><div><input aria-label="important"><p>Promotion</p></div></article></body></html>')
  let asked = 0
  dom.window.confirm = () => { asked++; return false }
  run(pickerSource)
  const container = dom.window.document.querySelector('article > div')!
  container.dispatchEvent(new dom.window.MouseEvent('mousemove', { bubbles: true }))
  container.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  await Promise.resolve()
  assert.equal(asked, 1)
  assert.equal(messages.filter(m => m.type === 'NOVA_WEB_ADD_RULE').length, 0)
  dom.window.close()
})

test('automatic content bootstrap applies only explicitly enabled profiles for the current origin', async () => {
  const { dom, model, run, saved, messages } = setup()
  saved['nova:web:https://example.com'] = model.normalize({ enabled: true, auto: true, dark: { enabled: true } })
  run(appearanceSource)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(messages.filter(m => m.type === 'NOVA_WEB_CSS').length, 1)
  assert.match(messages[0].css, /background-color/)
  dom.window.close()
  const second = setup()
  second.saved['nova:web:https://example.com'] = second.model.normalize({ enabled: true, auto: false, dark: { enabled: true } })
  second.run(appearanceSource)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(second.messages.length, 0)
  second.dom.window.close()
})
