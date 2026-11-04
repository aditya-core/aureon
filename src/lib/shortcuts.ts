import type { Shortcut } from './types'

export const STARTER_SHORTCUTS: Shortcut[] = [
  { id: 'google', title: 'Google', url: 'https://www.google.com', icon: 'G', position: 0 },
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com', icon: '▶', position: 1 },
  { id: 'gmail', title: 'Gmail', url: 'https://mail.google.com', icon: 'M', position: 2 },
  { id: 'github', title: 'GitHub', url: 'https://github.com', icon: '⌘', position: 3 },
]
export function validateShortcutUrl(value: string): string | null {
  const input = value.trim()
  if (!input || /\s/.test(input)) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.href
  } catch { return null }
}
