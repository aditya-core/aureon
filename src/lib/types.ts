export type Theme = 'midnight' | 'dawn' | 'aurora' | 'custom'
export type SearchEngine = 'google' | 'duckduckgo' | 'bing'
export type Widget = 'clock' | 'shortcuts' | 'notes' | 'tasks' | 'focus' | 'bookmarks'
export type Layout = 'focus' | 'workspace' | 'immersive'
export type Background = 'theme' | 'solid' | 'mist' | 'aurora' | 'dunes' | 'orbit' | 'horizon' | 'grove' | 'upload'
export type Motion = 'off' | 'subtle' | 'standard' | 'expressive'
export type DashboardSection = 'clock' | 'search' | 'shortcuts' | 'widgets'
export type WorkspaceWidget = 'notes' | 'tasks' | 'focus'
export type WidgetSize = 'normal' | 'wide'

export interface UserPreferences {
  theme: Theme
  accentColor: string
  wallpaper: string | null // Legacy field; uploaded images are stored separately in IndexedDB.
  background: Background
  backgroundColor: string
  customTextColor: string
  customSurfaceColor: string
  gradientStart: string
  gradientEnd: string
  gradientAngle: number
  borderIntensity: number
  shadowIntensity: number
  wallpaperX: number
  wallpaperY: number
  alignment: 'center' | 'left'
  sectionOrder: DashboardSection[]
  widgetSizes: Record<WorkspaceWidget, WidgetSize>
  overlay: number
  brightness: number
  blur: number
  surface: 'soft' | 'solid'
  clockFormat: '12h' | '24h'
  showSeconds: boolean
  displayName: string
  greetingEnabled: boolean
  animationIntensity: Motion
  reducedMotion: boolean
  visibleWidgets: Widget[]
  searchEngine: SearchEngine
  layout: Layout
  spacing: 'compact' | 'comfortable'
  shortcutOrder: string[]
  widgetOrder: WorkspaceWidget[]
}

export interface Shortcut { id: string; title: string; url: string; icon: string | null; position: number; category?: string; useFavicon?: boolean }
export interface Note { id: string; title: string; content: string; createdAt: string; updatedAt: string; pinned?: boolean }
export interface Task { id: string; title: string; completed: boolean; createdAt: string; priority?: 'low' | 'medium' | 'high'; dueDate?: string }
