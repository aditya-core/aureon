import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PREFERENCES } from '../lib/defaults'
import { getPreferences, savePreferences } from '../lib/storage'
import type { UserPreferences } from '../lib/types'

type SaveState = 'loading' | 'saved' | 'saving' | 'error'
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [status, setStatus] = useState<SaveState>('loading')
  const [ready, setReady] = useState(false)
  const current = useRef<UserPreferences>(DEFAULT_PREFERENCES)
  const pending = useRef<UserPreferences | null>(null)
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    const next = pending.current
    if (!next) return
    pending.current = null
    const savingRevision = revision.current
    queue.current = queue.current.catch(() => {}).then(() => savePreferences(next)).then(() => {
      if (alive.current && revision.current === savingRevision) setStatus('saved')
    }).catch(() => { if (alive.current) setStatus('error') })
  }, [])
  useEffect(() => {
    alive.current = true
    let active = true
    getPreferences().then(value => { if (active) { current.current = value; setPreferences(value); setStatus('saved'); setReady(true) } }).catch(() => { if (active) { setStatus('error'); setReady(true) } })
    const onPageHide = () => flush()
    window.addEventListener('pagehide', onPageHide)
    return () => { active = false; alive.current = false; window.removeEventListener('pagehide', onPageHide); flush() }
  }, [flush])
  const update = useCallback((change: Partial<UserPreferences>) => {
    const next = { ...current.current, ...change }
    current.current = next
    revision.current += 1
    pending.current = next
    setPreferences(next)
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 350)
  }, [flush])
  return { preferences, update, status, ready }
}
