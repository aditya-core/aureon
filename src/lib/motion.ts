import { useEffect, useState } from 'react'
import { DEFAULT_PREFERENCES } from './defaults'
import { getPreferences } from './storage'
import type { UserPreferences } from './types'

export type MotionLevel = 'off' | 'subtle' | 'standard' | 'expressive'
type MotionPreference = Pick<UserPreferences, 'animationIntensity' | 'reducedMotion'>

/** The single value every NOVA surface puts on its root as `data-motion`. */
export function motionLevel(preferences: MotionPreference): MotionLevel {
  return preferences.reducedMotion ? 'off' : preferences.animationIntensity
}

/**
 * Notifies when stored preferences change in any extension context, so a motion change
 * made in settings reaches open surface tabs without a reload. Missing storage events
 * (previews, tests, older runtimes) resolve to a no-op unsubscribe.
 */
export function subscribeToPreferences(listener: () => void): () => void {
  const events = typeof chrome === 'undefined' ? undefined : chrome.storage?.onChanged
  if (!events?.addListener) return () => {}
  const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'preferences')) listener()
  }
  events.addListener(onChanged)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    events.removeListener?.(onChanged)
  }
}

/** For surfaces (the toolbar popup) that do not otherwise keep a preferences object. */
export function useMotionLevel(initial: MotionLevel = motionLevel(DEFAULT_PREFERENCES)): MotionLevel {
  const [level, setLevel] = useState<MotionLevel>(initial)
  useEffect(() => {
    let active = true
    const load = () => { getPreferences().then(p => { if (active) setLevel(motionLevel(p)) }).catch(() => {}) }
    load()
    const stop = subscribeToPreferences(load)
    return () => { active = false; stop() }
  }, [])
  return level
}
