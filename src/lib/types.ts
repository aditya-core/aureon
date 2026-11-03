export type Theme = 'midnight' | 'dawn' | 'aurora' | 'custom'
export type SearchEngine = 'google' | 'duckduckgo' | 'bing'
export type Widget = 'clock' | 'shortcuts' | 'notes' | 'tasks' | 'focus' | 'bookmarks'
export type Layout = 'focus' | 'workspace' | 'immersive'
export type Background = 'theme' | 'solid' | 'mist' | 'aurora' | 'dunes' | 'orbit' | 'upload'
export type Motion = 'off' | 'subtle' | 'standard' | 'expressive'

export interface UserPreferences {
  theme: Theme
  accentColor: string
  wallpaper: string | null // Legacy field; uploaded images are stored separately in IndexedDB.
  background: Background
  backgroundColor: string
  overlay: number
  brightness: number
  blur: number
  surface: 'soft' | 'solid'
  clockFormat: '12h' | '24h'
  greetingEnabled: boolean
  animationIntensity: Motion
  reducedMotion: boolean
  visibleWidgets: Widget[]
  searchEngine: SearchEngine
  layout: Layout
  spacing: 'compact' | 'comfortable'
  shortcutOrder: string[]
}

export interface Shortcut { id: string; title: string; url: string; icon: string | null; position: number }
export interface Note { id: string; title: string; content: string; createdAt: string; updatedAt: string }
export interface Task { id: string; title: string; completed: boolean; createdAt: string }
