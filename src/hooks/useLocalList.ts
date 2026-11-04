import { useCallback, useEffect, useRef, useState } from 'react'

// Keep writes ordered across widget unmount/remount in this page. Other tabs still
// use last-writer-wins Chrome storage; there is no cross-tab transaction.
const writes = new WeakMap<Function, Promise<void>>()

export function useLocalList<T>(load: () => Promise<T[]>, save: (items: T[]) => Promise<void>, delay = 0) {
  const [items, setItems] = useState<T[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const current = useRef<T[]>([])
  const pending = useRef<T[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    const next = pending.current
    if (!next) return
    pending.current = null
    const previous = writes.get(save) ?? Promise.resolve()
    const operation = previous.catch(() => {}).then(() => save(next))
    writes.set(save, operation)
    void operation.catch(() => { if (alive.current) setError('Could not save changes. Please try again.') })
  }, [save])
  useEffect(() => {
    let mounted = true
    alive.current = true
    void (writes.get(save) ?? Promise.resolve()).then(load).then(value => { if (mounted) { current.current = value; setItems(value); setReady(true) } }).catch(() => { if (mounted) setError('Could not load this data. Reload and try again.') })
    window.addEventListener('pagehide', flush)
    return () => { mounted = false; alive.current = false; window.removeEventListener('pagehide', flush); flush() }
  }, [load, flush, save])
  const change = useCallback((fn: (previous: T[]) => T[]) => {
    const next = fn(current.current)
    current.current = next; setItems(next); pending.current = next; setError('')
    if (timer.current) clearTimeout(timer.current)
    if (delay) timer.current = setTimeout(flush, delay); else flush()
  }, [delay, flush])
  return { items, change, ready, error }
}
