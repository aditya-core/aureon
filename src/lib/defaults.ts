import type { UserPreferences } from './types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'midnight', accentColor: '#a5b4fc', wallpaper: null,
  background: 'theme', backgroundColor: '#121824', overlay: 20, brightness: 100, blur: 0, surface: 'soft',
  clockFormat: '12h', greetingEnabled: true, animationIntensity: 'subtle', reducedMotion: false,
  visibleWidgets: ['clock', 'shortcuts'], searchEngine: 'google', layout: 'focus', spacing: 'comfortable',
  shortcutOrder: ['Google', 'YouTube', 'Gmail', 'GitHub'],
}
