import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.com/', pretendToBeVisual: true, runScripts: 'outside-only' })
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true })
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true })
vm.runInContext(readFileSync('public/web/model.js', 'utf8'), dom.getInternalVMContext())
Object.defineProperty(globalThis, 'NovaWebModel', { value: (dom.window as any).NovaWebModel, configurable: true })
const data: Record<string, any> = {}; const messages: any[] = []; const scripts: any[] = []; const requests: any[] = []
let url = 'https://example.com/story'; let grant = false
const opened: any[] = []
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
  runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
  tabs: { create: async (value: any) => { opened.push(value) }, query: async () => [{ id: 8, url }], sendMessage: async (_id: number, msg: any) => { messages.push(msg); return msg.type === 'NOVA_WEB_STATUS' ? { active: false } : { active: true } } },
  storage: { local: { get: async (key: string) => ({ [key]: data[key] }), set: async (value: any) => Object.assign(data, value) } },
  permissions: { contains: async () => false, request: async (value: any) => { requests.push(value); return grant } },
  scripting: { executeScript: async (params: any) => { scripts.push(params) } },
} })
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const { Popup } = await import('../src/popup/popup')
afterEach(() => { cleanup(); for (const key of Object.keys(data)) delete data[key]; messages.length = 0; scripts.length = 0; requests.length = 0; opened.length = 0; url = 'https://example.com/story'; grant = false })

test('popup enables dark styling for only the current origin on user action', async () => {
  const view = render(createElement(Popup))
  await view.findByText('example.com')
  assert.equal(scripts.length, 0, 'opening popup does not inject')
  await waitFor(() => assert.equal((view.getByRole('checkbox', { name: /Dark mode/ }) as HTMLInputElement).disabled, false))
  fireEvent.click(view.getByRole('checkbox', { name: /Dark mode/ }))
  await waitFor(() => assert.equal(data['nova:web:https://example.com']?.dark.enabled, true))
  await waitFor(() => assert.equal(messages.at(-1)?.type, 'NOVA_WEB_SET'))
  assert.deepEqual(scripts[0].files, ['web/model.js','web/appearance.js'])
  assert.equal(requests.length, 0, 'temporary styling does not request host access')
})

test('popup handles denied site permission without registering or saving automatic access', async () => {
  const view = render(createElement(Popup))
  await view.findByText('example.com')
  await waitFor(() => assert.equal((view.getByRole('checkbox', { name: /Apply automatically on this site/ }) as HTMLInputElement).disabled, false))
  fireEvent.click(view.getByRole('checkbox', { name: /Apply automatically on this site/ }))
  await view.findByRole('alert')
  assert.deepEqual(requests, [{ origins: ['https://example.com/*'] }])
  assert.equal(data['nova:web:https://example.com'], undefined)
  assert.equal(scripts.length, 0)
})

test('popup disables controls for protected browser pages', async () => {
  url = 'chrome://settings'
  const view = render(createElement(Popup))
  await view.findByText('Unsupported page')
  assert.equal((view.getByRole('checkbox', { name: /Dark mode/ }) as HTMLInputElement).disabled, true)
  assert.equal(scripts.length, 0)
})

test('a saved profile can be explicitly reapplied after navigation without host permission', async () => {
  data['nova:web:https://example.com'] = { enabled: true, dark: { enabled: true } }
  const view = render(createElement(Popup))
  await view.findByText('Saved profile · not active in this tab')
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Apply saved styling to this tab' }) as HTMLButtonElement).disabled, false))
  fireEvent.click(view.getByRole('button', { name: 'Apply saved styling to this tab' }))
  await view.findByText('Styling active in this tab')
  assert.equal(requests.length, 0)
})


test('command centre is accessible from the popup even on unsupported pages', async () => {
  url = 'chrome://settings'
  const view = render(createElement(Popup))
  await view.findByText('Unsupported page')
  fireEvent.click(view.getByRole('button', { name: /Command Centre/ }))
  await waitFor(() => assert.deepEqual(opened, [{ url: 'chrome-extension://id/command.html' }]))
})
