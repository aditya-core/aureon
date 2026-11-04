import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement } from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true })
Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
Object.defineProperty(globalThis, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLInputElement', { value: dom.window.HTMLInputElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: dom.window.HTMLTextAreaElement, configurable: true })
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true, writable: true })
dom.window.confirm = () => true
const data: Record<string, unknown> = {}
let writes = 0
let writeDelay = 0
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { storage: { local: {
  get: async (key: string) => ({ [key]: data[key] }),
  set: async (values: Record<string, unknown>) => { if (writeDelay) await new Promise(resolve => setTimeout(resolve, writeDelay)); Object.assign(data, values); writes++ },
}, onChanged: { addListener: () => {}, removeListener: () => {} } } } })
const { render, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react')
const { Shortcuts } = await import('../src/components/Shortcuts')
const { Notes } = await import('../src/components/Notes')
const { Tasks } = await import('../src/components/Tasks')
const { Focus } = await import('../src/components/Focus')
const { Clock } = await import('../src/components/Clock')
const { DEFAULT_PREFERENCES } = await import('../src/lib/defaults')
const { default: Settings } = await import('../src/components/settings/Settings')
const { useState } = await import('react')
import type { UserPreferences } from '../src/lib/types'
afterEach(() => { cleanup(); for (const key of Object.keys(data)) delete data[key]; writes = 0; writeDelay = 0 })

test('shortcuts can be added, edited and deleted without automatic favicon requests', async () => {
  const view = render(createElement(Shortcuts, { initialOrder: ['Google','YouTube','Gmail','GitHub'] }))
  await view.findByText('Google')
  fireEvent.click(view.getByRole('button', { name: 'Add shortcut' }))
  fireEvent.change(view.getByLabelText('Name'), { target: { value: 'Example' } })
  fireEvent.change(view.getByLabelText('Website'), { target: { value: 'example.com' } })
  fireEvent.click(view.getByRole('button', { name: 'Save shortcut' }))
  await view.findByText('Example')
  await waitFor(() => assert.ok(Array.isArray(data.shortcuts)))
  assert.equal((data.shortcuts as Array<{useFavicon?: boolean}>).at(-1)?.useFavicon, false)
  fireEvent.click(view.getByRole('button', { name: 'Edit Example' }))
  fireEvent.change(view.getByLabelText('Name'), { target: { value: 'Renamed' } })
  fireEvent.click(view.getByRole('button', { name: 'Save shortcut' }))
  await view.findByText('Renamed')
  fireEvent.click(view.getByRole('button', { name: 'Move Renamed earlier' }))
  await waitFor(() => assert.equal((data.shortcuts as Array<{title: string}>)[3]?.title, 'Renamed'))
  fireEvent.click(view.getByRole('button', { name: 'Delete Renamed' }))
  await waitFor(() => assert.equal(view.queryByText('Renamed'), null))
})

test('notes create, autosave, pin and search with local persistence', async () => {
  const view = render(createElement(Notes))
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Create note' }) as HTMLButtonElement).disabled, false))
  fireEvent.click(view.getByRole('button', { name: 'Create note' }))
  fireEvent.change(view.getByLabelText('Note title'), { target: { value: 'Planning' } })
  fireEvent.change(view.getByLabelText('Note content'), { target: { value: 'Local thoughts' } })
  fireEvent.click(view.getByRole('button', { name: 'Pin note' }))
  await waitFor(() => assert.equal((data.notes as Array<{ content: string; pinned: boolean }>)?.[0]?.content, 'Local thoughts'), { timeout: 2000 })
  assert.equal((data.notes as Array<{pinned: boolean}>)[0].pinned, true)
  fireEvent.change(view.getByLabelText('Search notes'), { target: { value: 'missing' } })
  assert.ok(view.getByText('No notes match your search.'))
  fireEvent.click(view.getByRole('button', { name: 'Delete note' }))
  await waitFor(() => assert.equal((data.notes as unknown[])?.length, 0), { timeout: 2000 })
})

test('tasks support due date, priority, completion, filters and deletion', async () => {
  const view = render(createElement(Tasks))
  await waitFor(() => assert.equal((view.getByLabelText('Task name') as HTMLInputElement).disabled, false))
  fireEvent.change(view.getByLabelText('Task name'), { target: { value: 'Ship' } })
  fireEvent.change(view.getByLabelText('Task priority'), { target: { value: 'high' } })
  fireEvent.change(view.getByLabelText('Task due date'), { target: { value: '2026-12-31' } })
  fireEvent.click(view.getByRole('button', { name: 'Add task' }))
  await view.findByText('Ship')
  await waitFor(() => assert.equal((data.tasks as Array<{ priority: string }>)?.[0]?.priority, 'high'))
  assert.equal((data.tasks as Array<{dueDate: string}>)[0].dueDate, '2026-12-31')
  fireEvent.click(view.getByRole('button', { name: 'Edit Ship' }))
  fireEvent.change(view.getByLabelText('Task name'), { target: { value: 'Ship safely' } })
  fireEvent.click(view.getByRole('button', { name: 'Save task' }))
  await view.findByText('Ship safely')
  fireEvent.click(view.getByRole('checkbox'))
  await waitFor(() => assert.equal((data.tasks as Array<{ completed: boolean }>)?.[0]?.completed, true))
  fireEvent.click(view.getByRole('button', { name: 'pending' }))
  assert.equal(view.queryByText('Ship safely'), null)
  fireEvent.click(view.getByRole('button', { name: 'completed' }))
  fireEvent.click(view.getByRole('button', { name: 'Delete Ship safely' }))
  await waitFor(() => assert.equal((data.tasks as unknown[])?.length, 0))
})

test('focus timer starts, pauses, resumes and resets without per-second writes', async () => {
  const view = render(createElement(Focus))
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Start session' }) as HTMLButtonElement).disabled, false))
  fireEvent.click(view.getByRole('button', { name: 'Start session' }))
  await view.findByRole('button', { name: 'Pause' })
  await waitFor(() => assert.ok((data.focusState as { endsAt: number })?.endsAt))
  const startedWrites = writes
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)) })
  assert.equal(writes, startedWrites, 'timer ticks must not write to storage')
  fireEvent.click(view.getByRole('button', { name: 'Pause' }))
  await view.findByRole('button', { name: 'Resume' })
  fireEvent.click(view.getByRole('button', { name: 'Resume' }))
  await view.findByRole('button', { name: 'Pause' })
  fireEvent.click(view.getByRole('button', { name: 'Reset' }))
  await view.findByRole('button', { name: 'Start session' })
  await waitFor(() => assert.equal((data.focusState as { endsAt: number | null })?.endsAt, null))
})


test('focus timer recovers a completed session when reopened', async () => {
  data.focusState = { mode: 'focus', durations: { focus: 25, short: 5, long: 15 }, remainingMs: 1500000, endsAt: Date.now() - 5000, completed: false, sessions: 2 }
  const view = render(createElement(Focus))
  await view.findByText('Session complete. Take a moment to pause.')
  await waitFor(() => assert.equal((data.focusState as {sessions: number}).sessions, 3))
})


test('clock renders local date, name and optional seconds with cleanup', () => {
  let added = 0, removed = 0
  const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document)
  document.addEventListener = ((type: string, ...args: Parameters<Document['addEventListener']> extends [string, ...infer R] ? R : never) => { if (type === 'visibilitychange') added++; return add(type, ...args) }) as typeof document.addEventListener
  document.removeEventListener = ((type: string, ...args: Parameters<Document['removeEventListener']> extends [string, ...infer R] ? R : never) => { if (type === 'visibilitychange') removed++; return remove(type, ...args) }) as typeof document.removeEventListener
  try {
    const view = render(createElement(Clock, { preferences: { ...DEFAULT_PREFERENCES, displayName: 'Alex', showSeconds: true, clockFormat: '24h' } }))
    assert.ok(view.getByText(/Alex/))
    assert.match(view.container.querySelector('.clock-time')?.textContent ?? '', /\d.*\d.*\d/)
    assert.ok(view.container.querySelector('.date-line')?.textContent?.length)
    view.unmount()
    assert.equal(added, removed)
    assert.ok(added >= 1)
  } finally { document.addEventListener = add; document.removeEventListener = remove }
})


test('note edits survive hiding and immediately reopening the widget while a write is pending', async () => {
  const view = render(createElement(Notes))
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Create note' }) as HTMLButtonElement).disabled, false))
  fireEvent.click(view.getByRole('button', { name: 'Create note' }))
  fireEvent.change(view.getByLabelText('Note content'), { target: { value: 'Keep this' } })
  writeDelay = 100
  view.unmount()
  const reopened = render(createElement(Notes))
  await waitFor(() => assert.equal((reopened.getByLabelText('Note content') as HTMLTextAreaElement).value, 'Keep this'))
})


test('workspace preset and keyboard widget ordering update settings', async () => {
  function Harness() {
    const [p, setP] = useState(DEFAULT_PREFERENCES)
    return createElement(Settings, { preferences: p, update: (change: Partial<UserPreferences>) => setP(previous => ({ ...previous, ...change })), status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false })
  }
  const view = render(createElement(Harness))
  fireEvent.click(view.getByRole('button', { name: 'Layout', exact: true }))
  fireEvent.click(view.getByRole('button', { name: /^Workspace A little more room to do$/ }))
  assert.equal((view.getByLabelText('Focus timer') as HTMLInputElement).checked, true)
  fireEvent.click(await view.findByRole('button', { name: 'Move Focus timer up' }))
  const buttons = view.getAllByRole('button', { name: /Move (Notes|Tasks|Focus timer) up/ })
  assert.equal(buttons[1].getAttribute('aria-label'), 'Move Focus timer up')
})

test('studio updates colors, section order, width and wallpaper position without replacing data', async () => {
  const updates: Partial<UserPreferences>[] = []
  function Harness() {
    const [p, setP] = useState(DEFAULT_PREFERENCES)
    return createElement(Settings, { preferences: p, update: (change: Partial<UserPreferences>) => { updates.push(change); setP(previous => ({ ...previous, ...change })) }, status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false })
  }
  const view = render(createElement(Harness))
  fireEvent.click(view.getByRole('button', { name: 'Studio', exact: true }))
  fireEvent.change(await view.findByLabelText('Text'), { target: { value: '#123456' } })
  assert.ok(updates.some(x => x.customTextColor === '#123456' && x.theme === 'custom'))
  fireEvent.click(view.getByRole('button', { name: 'Layout', exact: true }))
  fireEvent.click(await view.findByRole('button', { name: 'Move Search up' }))
  assert.deepEqual(updates.at(-1)?.sectionOrder, ['search', 'clock', 'shortcuts', 'widgets'])
  fireEvent.change(view.getByLabelText('Notes width'), { target: { value: 'wide' } })
  assert.equal(updates.at(-1)?.widgetSizes?.notes, 'wide')
  fireEvent.click(view.getByRole('button', { name: 'Backgrounds', exact: true }))
  fireEvent.change(view.getByLabelText(/Horizontal position/), { target: { value: '20' } })
  assert.equal(updates.at(-1)?.wallpaperX, 20)
})

test('profiles apply and save customization snapshots without productivity data', async () => {
  const updates: Partial<UserPreferences>[] = []
  function Harness() {
    const [p, setP] = useState({ ...DEFAULT_PREFERENCES, displayName: 'Private' })
    return createElement(Settings, { preferences: p, update: (change: Partial<UserPreferences>) => { updates.push(change); setP(previous => ({ ...previous, ...change })) }, status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false })
  }
  const view = render(createElement(Harness))
  fireEvent.click(view.getByRole('button', { name: 'Profiles', exact: true }))
  const study = (await view.findByText('Study')).closest('.profile-card')!
  const { within } = await import('@testing-library/react')
  fireEvent.click(within(study as HTMLElement).getByRole('button', { name: 'Apply' }))
  assert.equal(updates.at(-1)?.theme, 'aurora')
  fireEvent.change(view.getByLabelText('Create a profile from this look'), { target: { value: 'Evening' } })
  fireEvent.click(view.getByRole('button', { name: 'Save profile' }))
  await waitFor(() => assert.equal((data.profiles as Array<{name: string}>)?.at(-1)?.name, 'Evening'))
  const saved = (data.profiles as Array<{ customization: Record<string, unknown> }>).at(-1)!.customization
  assert.equal(saved.theme, 'aurora')
  assert.equal(saved.displayName, undefined)
  assert.equal(data.notes, undefined)
})

test('transfer rejects invalid input and accepts a valid customization file', async () => {
  const { exportCustomization } = await import('../src/lib/studio')
  const updates: Partial<UserPreferences>[] = []
  const view = render(createElement(Settings, { preferences: DEFAULT_PREFERENCES, update: (change: Partial<UserPreferences>) => updates.push(change), status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false }))
  fireEvent.click(view.getByRole('button', { name: 'Transfer', exact: true }))
  await view.findByText('Bring a look back')
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
  const invalid = new dom.window.File(['{}'], 'bad.json', { type: 'application/json' })
  Object.defineProperty(invalid, 'text', { value: async () => '{}' })
  fireEvent.change(input, { target: { files: [invalid] } })
  await view.findByRole('alert')
  assert.equal(updates.length, 0)
  const oversized = new dom.window.File([new Uint8Array(128 * 1024 + 1)], 'large.json', { type: 'application/json' })
  fireEvent.change(input, { target: { files: [oversized] } })
  await view.findByText('Choose a JSON file smaller than 128 KB.')
  assert.equal(updates.length, 0)
  const json = exportCustomization({ ...DEFAULT_PREFERENCES, theme: 'aurora' })
  const valid = new dom.window.File([json], 'nova.json', { type: 'application/json' })
  Object.defineProperty(valid, 'text', { value: async () => json })
  fireEvent.change(input, { target: { files: [valid] } })
  await waitFor(() => assert.equal(updates.at(-1)?.theme, 'aurora'))
})

test('native drag reorders sections while retaining keyboard alternatives', async () => {
  const updates: Partial<UserPreferences>[] = []
  function Harness() {
    const [p, setP] = useState(DEFAULT_PREFERENCES)
    return createElement(Settings, { preferences: p, update: (change: Partial<UserPreferences>) => { updates.push(change); setP(previous => ({ ...previous, ...change })) }, status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false })
  }
  const view = render(createElement(Harness))
  fireEvent.click(view.getByRole('button', { name: 'Layout', exact: true }))
  const group = await view.findByRole('group', { name: 'Dashboard section order' })
  const rows = group.querySelectorAll('.studio-order-row')
  const transfer = { effectAllowed: '', setData: () => {} }
  fireEvent.dragStart(rows[3], { dataTransfer: transfer })
  fireEvent.dragOver(rows[0], { dataTransfer: transfer })
  fireEvent.drop(rows[0], { dataTransfer: transfer })
  assert.deepEqual(updates.at(-1)?.sectionOrder, ['widgets', 'clock', 'search', 'shortcuts'])
  assert.ok(view.getByRole('button', { name: 'Move Search up' }))
})

test('moving dashboard sections preserves an in-progress note', async () => {
  const { default: App } = await import('../src/App')
  data.preferences = { ...DEFAULT_PREFERENCES, layout: 'workspace', visibleWidgets: ['clock', 'shortcuts', 'notes', 'tasks', 'focus'] }
  const view = render(createElement(App))
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Create note' }) as HTMLButtonElement).disabled, false))
  fireEvent.click(view.getByRole('button', { name: 'Create note' }))
  fireEvent.change(view.getByLabelText('Note content'), { target: { value: 'Do not lose this' } })
  fireEvent.click(view.getByRole('button', { name: 'Open settings' }))
  const layout = await view.findByRole('button', { name: 'Layout', exact: true })
  fireEvent.click(layout)
  fireEvent.click(await view.findByRole('button', { name: 'Move Workspace widgets up' }))
  fireEvent.click(view.getByRole('button', { name: 'Close settings' }))
  assert.equal((view.getByLabelText('Note content') as HTMLTextAreaElement).value, 'Do not lose this')
})

test('focus timer retains a newly started session when hidden and reopened during a pending write', async () => {
  const view = render(createElement(Focus))
  await waitFor(() => assert.equal((view.getByRole('button', { name: 'Start session' }) as HTMLButtonElement).disabled, false))
  writeDelay = 100
  fireEvent.click(view.getByRole('button', { name: 'Start session' }))
  view.unmount()
  const reopened = render(createElement(Focus))
  await waitFor(() => assert.ok(reopened.getByRole('button', { name: 'Pause' })), { timeout: 1000 })
})

test('pending focus writes do not roll back later local timer actions', async () => {
  let listener: ((changes: Record<string, { newValue: unknown }>, area: string) => void) | undefined
  const original = chrome.storage.onChanged
  Object.defineProperty(chrome.storage, 'onChanged', { configurable: true, value: {
    addListener: (fn: typeof listener) => { listener = fn }, removeListener: () => {},
  } })
  try {
    const view = render(createElement(Focus))
    await waitFor(() => assert.equal((view.getByRole('button', { name: 'Start session' }) as HTMLButtonElement).disabled, false))
    writeDelay = 100
    fireEvent.click(view.getByRole('button', { name: 'Start session' }))
    const earlier = { mode: 'focus', durations: { focus: 25, short: 5, long: 15 }, remainingMs: 1500000, endsAt: Date.now() + 1500000, completed: false, sessions: 0 }
    fireEvent.click(view.getByRole('button', { name: 'Pause' }))
    await act(async () => { listener?.({ focusState: { newValue: earlier } }, 'local') })
    assert.ok(view.getByRole('button', { name: 'Resume' }))
    await waitFor(() => assert.equal((data.focusState as {endsAt: number | null})?.endsAt, null))
  } finally { Object.defineProperty(chrome.storage, 'onChanged', { configurable: true, value: original }) }
})

test('restoring layout resets customization while leaving productivity data untouched', async () => {
  data.notes = [{ id: 'n', title: 'Keep', content: 'Important', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]
  const changes: Partial<UserPreferences>[] = []
  const altered = { ...DEFAULT_PREFERENCES, layout: 'workspace' as const, alignment: 'left' as const, sectionOrder: ['widgets', 'clock', 'search', 'shortcuts'] as UserPreferences['sectionOrder'], widgetSizes: { notes: 'wide' as const, tasks: 'wide' as const, focus: 'normal' as const } }
  const view = render(createElement(Settings, { preferences: altered, update: (change: Partial<UserPreferences>) => changes.push(change), status: 'saved', close: () => {}, upload: async () => {}, removeWallpaper: async () => {}, hasWallpaper: false }))
  fireEvent.click(view.getByRole('button', { name: 'Layout', exact: true }))
  fireEvent.click(view.getByRole('button', { name: 'Restore default layout' }))
  assert.deepEqual(changes.at(-1)?.sectionOrder, DEFAULT_PREFERENCES.sectionOrder)
  assert.deepEqual(changes.at(-1)?.widgetSizes, DEFAULT_PREFERENCES.widgetSizes)
  assert.equal((data.notes as Array<{content: string}>)[0].content, 'Important')
})

test('default new tabs defer wallpaper storage until settings is opened', async () => {
  const { default: App } = await import('../src/App')
  let reads = 0
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => { reads++; throw new Error('IndexedDB unavailable') } } })
  try {
    const view = render(createElement(App))
    const open = await view.findByRole('button', { name: 'Open settings' })
    assert.equal(reads, 0)
    fireEvent.click(open)
    await waitFor(() => assert.equal(reads, 1))
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
})

test('a selected uploaded wallpaper is loaded without opening settings', async () => {
  const { default: App } = await import('../src/App')
  data.preferences = { ...DEFAULT_PREFERENCES, background: 'upload' }
  let reads = 0
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => { reads++; throw new Error('IndexedDB unavailable') } } })
  try {
    const view = render(createElement(App))
    await view.findByText('Your wallpaper is unavailable. Showing the theme background.')
    assert.equal(reads, 1)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
})
