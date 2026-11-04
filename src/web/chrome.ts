import type { SiteProfile } from './types'

export function matchPattern(origin: string): string | null {
  try {
    const url = new URL(origin)
    // Chrome's match patterns cover every port; do not silently widen a port-specific grant.
    if (!['http:', 'https:'].includes(url.protocol) || url.port || !url.hostname) return null
    return `${url.protocol}//${url.hostname}/*`
  } catch { return null }
}
export async function registrationId(pattern: string): Promise<string> {
  // A digest avoids collisions that could otherwise unregister a different site's script.
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pattern))
  return `nova-web-${Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')}`
}
export async function ensureContent(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['web/model.js', 'web/appearance.js'] })
}
export async function applyProfile(tabId: number, profile: SiteProfile) {
  await ensureContent(tabId)
  const result = await chrome.tabs.sendMessage(tabId, { type: 'NOVA_WEB_SET', profile }) as { active?: boolean; error?: string } | undefined
  if (!result || result.error) throw new Error(result?.error || 'Unable to apply settings on this page.')
  return result.active === true
}
export async function enableAutomatic(pattern: string) {
  // Call immediately from a click handler: Chrome requires a user gesture.
  const granted = await chrome.permissions.request({ origins: [pattern] })
  if (!granted) return false
  try {
    const id = await registrationId(pattern)
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
    if (existing.length) await chrome.scripting.updateContentScripts([{ id, matches: [pattern], js: ['web/model.js', 'web/appearance.js'], runAt: 'document_start', allFrames: false }])
    else await chrome.scripting.registerContentScripts([{ id, matches: [pattern], js: ['web/model.js', 'web/appearance.js'], runAt: 'document_start', allFrames: false, persistAcrossSessions: true }])
    return true
  } catch (error) {
    await chrome.permissions.remove({ origins: [pattern] }).catch(() => false)
    throw error
  }
}
export async function disableAutomatic(pattern: string) {
  const id = await registrationId(pattern)
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [id] })
  const removed = await chrome.permissions.remove({ origins: [pattern] })
  if (!removed && await chrome.permissions.contains({ origins: [pattern] })) throw new Error('Chrome did not revoke this site permission.')
}
