import type { UserPreferences } from './types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'midnight', accentColor: '#a5b4fc', wallpaper: null,
  background: 'theme', backgroundColor: '#121824', customTextColor: '#f7f4fb', customSurfaceColor: '#292333',
  gradientStart: '#343047', gradientEnd: '#10121b', gradientAngle: 145, borderIntensity: 50, shadowIntensity: 50,
  wallpaperX: 50, wallpaperY: 50, alignment: 'center', sectionOrder: ['clock', 'search', 'shortcuts', 'widgets'], widgetSizes: { notes: 'normal', tasks: 'normal', focus: 'normal' }, overlay: 20, brightness: 100, blur: 0, surface: 'soft',
  clockFormat: '12h', showSeconds: false, displayName: '', greetingEnabled: true, animationIntensity: 'subtle', reducedMotion: false,
  visibleWidgets: ['clock', 'shortcuts'], searchEngine: 'google', layout: 'focus', spacing: 'comfortable',
  shortcutOrder: ['Google', 'YouTube', 'Gmail', 'GitHub'], widgetOrder: ['notes', 'tasks', 'focus'],
}
