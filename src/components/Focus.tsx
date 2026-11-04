import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_FOCUS, formatRemaining, normalizeFocus, reconcileFocus, remainingFocus } from '../lib/focus'
import type { FocusMode, FocusState } from '../lib/focus'
import { getFocusState, saveFocusState } from '../lib/storage'

const labels: Record<FocusMode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
// Keep timer writes ordered across hide/reopen within this page. Cross-tab
// changes remain last-writer-wins because Chrome storage has no transaction.
let focusWrites: Promise<void> = Promise.resolve()
let pendingFocusWrites = 0
export function Focus() {
  const [state, setState] = useState<FocusState>(DEFAULT_FOCUS)
  const [now, setNow] = useState(Date.now)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const current = useRef(state)
  const alive = useRef(true)
  const commit = useCallback((next: FocusState) => {
    current.current = next; setState(next); setError('')
    pendingFocusWrites += 1
    const operation = focusWrites.catch(() => {}).then(() => saveFocusState(next))
    focusWrites = operation
    void operation.then(() => { pendingFocusWrites -= 1 }, () => { pendingFocusWrites -= 1; if (alive.current) setError('Could not save your timer. Please try again.') })
  }, [])
  useEffect(() => {
    let mounted = true; alive.current = true
    focusWrites.then(getFocusState).then(raw => { if (!mounted) return; const original = normalizeFocus(raw); const next = reconcileFocus(original, Date.now()); current.current = next; setState(next); setReady(true); if (next !== original) commit(next) }).catch(() => { if (mounted) setError('Could not load the focus timer.') })
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => { if (area === 'local' && changes.focusState && pendingFocusWrites === 0) { const next = normalizeFocus(changes.focusState.newValue); current.current = next; setState(next) } }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.addListener(onChange)
    return () => { mounted = false; alive.current = false; if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.removeListener(onChange) }
  }, [commit])
  useEffect(() => {
    if (!ready || state.endsAt === null) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      if (timer) clearTimeout(timer)
      if (document.hidden) return
      const time = Date.now(); setNow(time)
      const next = reconcileFocus(current.current, time)
      if (next !== current.current) { commit(next); return }
      timer = setTimeout(tick, Math.min(1000, Math.max(50, (current.current.endsAt ?? time) - time)))
    }
    document.addEventListener('visibilitychange', tick); tick()
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', tick) }
  }, [state.endsAt, ready, commit])
  const remaining = remainingFocus(state, now)
  function selectMode(mode: FocusMode) { commit({ ...state, mode, remainingMs: state.durations[mode] * 60_000, endsAt: null, completed: false }) }
  return <section className="widget productivity-widget focus-widget" aria-labelledby="focus-heading"><div className="widget-heading"><div><span className="widget-kicker">A MOMENT FOR WHAT MATTERS</span><h2 id="focus-heading">Focus timer</h2></div><span className="widget-number">{state.sessions} SESSIONS</span></div>
    {error && <p role="alert" className="widget-error">{error}</p>}{!ready && !error && <p className="helper">Loading timer…</p>}
    <div className="task-filters">{(['focus','short','long'] as FocusMode[]).map(mode => <button key={mode} disabled={!ready} aria-pressed={state.mode === mode} onClick={() => selectMode(mode)}>{labels[mode]}</button>)}</div>
    <div className="focus-time" aria-label={`${labels[state.mode]} time remaining`}>{formatRemaining(remaining)}</div>
    <p className="focus-message" role="status">{state.completed ? (state.mode === 'focus' ? 'Session complete. Take a moment to pause.' : 'Break complete. Ready when you are.') : state.endsAt ? 'One thing at a time.' : 'Make a little room to focus.'}</p>
    <div className="focus-actions"><button disabled={!ready} onClick={() => { const time = Date.now(); setNow(time); if (state.endsAt !== null) { const settled = reconcileFocus(state, time); commit(settled !== state ? settled : { ...state, remainingMs: remainingFocus(state, time), endsAt: null }) } else { const ms = state.remainingMs > 0 ? state.remainingMs : state.durations[state.mode] * 60_000; commit({ ...state, remainingMs: ms, endsAt: time + ms, completed: false }) } }}>{state.endsAt ? 'Pause' : state.remainingMs < state.durations[state.mode] * 60_000 && !state.completed ? 'Resume' : 'Start session'}</button><button disabled={!ready} onClick={() => commit({ ...state, endsAt: null, remainingMs: state.durations[state.mode] * 60_000, completed: false })}>Reset</button></div>
    <label className="duration-setting">{labels[state.mode]} duration (minutes)<input type="number" min="1" max="180" disabled={!ready || state.endsAt !== null} value={state.durations[state.mode]} onChange={e => { const n = Number(e.target.value); if (!Number.isInteger(n) || n < 1 || n > 180) return; commit({ ...state, durations: { ...state.durations, [state.mode]: n }, remainingMs: n * 60_000, completed: false }) }}/></label>
  </section>
}
