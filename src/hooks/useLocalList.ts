import { useCallback, useEffect, useRef, useState } from 'react'

// Keep writes ordered across widget unmount/remount in this page. Other tabs still
// use last-writer-wins Chrome storage; there is no cross-tab transaction.
const writes = new WeakMap<Function, Promise<void>>()

export function useLocalList<T>(load: () => Promise<T[]>, save: (items: T[]) => Promise<void>, delay = 0, storageKey?: string) {
  const [items, setItems] = useState<T[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const current = useRef<T[]>([])
  const pending = useRef<T[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)
  const inflight = useRef(0)
  const loadRevision = useRef(0)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    const next = pending.current
    if (!next) return
    pending.current = null
    const previous = writes.get(save) ?? Promise.resolve()
    inflight.current += 1
    const operation = previous.catch(() => {}).then(() => save(next))
    writes.set(save, operation)
    void operation.then(() => { inflight.current -= 1 }, () => { inflight.current -= 1; if (alive.current) setError('Could not save changes. Please try again.') })
  }, [save])
  useEffect(() => {
    let mounted = true
    alive.current = true
    const initialRevision = loadRevision.current
    void (writes.get(save) ?? Promise.resolve()).then(load).then(value => { if (mounted) { if (loadRevision.current === initialRevision) { current.current = value; setItems(value) } setReady(true) } }).catch(() => { if (mounted) setError('Could not load this data. Reload and try again.') })
    window.addEventListener('pagehide', flush)
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (storageKey && area === 'local' && changes[storageKey] && !pending.current && inflight.current === 0) { const revision=++loadRevision.current; void load().then(value=>{if(mounted && revision===loadRevision.current && !pending.current && inflight.current === 0){current.current=value;setItems(value)}}).catch(()=>{if(mounted)setError('Could not refresh this data.')}) } }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.addListener(onStorage)
    return () => { mounted = false; alive.current = false; window.removeEventListener('pagehide', flush); if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) chrome.storage.onChanged.removeListener(onStorage); flush() }
  }, [load, flush, save, storageKey])
  const change = useCallback((fn: (previous: T[]) => T[]) => {
    loadRevision.current += 1
    const next = fn(current.current)
    current.current = next; setItems(next); pending.current = next; setError('')
    if (timer.current) clearTimeout(timer.current)
    if (delay) timer.current = setTimeout(flush, delay); else flush()
  }, [delay, flush])
  return { items, change, ready, error }
}
