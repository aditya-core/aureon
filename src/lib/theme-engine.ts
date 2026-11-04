import type { CSSProperties } from 'react'
import { THEMES } from '../config/themes'
import { contrastRatio } from './color'
import type { UserPreferences } from './types'

export function themeStyles(p: UserPreferences): CSSProperties {
  const t = THEMES[p.theme]
  const panel = p.theme === 'custom' ? p.customSurfaceColor : t.solidSurface
  const desiredInk = p.theme === 'custom' ? p.customTextColor : t.ink
  const panelInk = contrastRatio(desiredInk, panel) >= 4.5 ? desiredInk : (contrastRatio('#ffffff', panel) >= contrastRatio('#171717', panel) ? '#ffffff' : '#171717')
  const panelAccent = p.theme === 'custom' && contrastRatio(p.accentColor, panel) < 3 ? panelInk : (p.theme === 'custom' ? p.accentColor : t.accent)
  const themeBackground = p.theme === 'custom' ? `linear-gradient(${p.gradientAngle}deg, ${p.gradientStart}, ${p.gradientEnd})` : t.background
  const backgrounds: Record<string, string> = {
    theme: themeBackground,
    solid: p.backgroundColor,
    mist: 'radial-gradient(ellipse at 30% 25%, #53567a, transparent 60%), linear-gradient(145deg, #121a28, #263548)',
    aurora: 'radial-gradient(ellipse at 30% 35%, #1c806c, transparent 50%), radial-gradient(ellipse at 75% 58%, #315d98, transparent 55%), #0b1b2a',
    dunes: 'url("./wallpapers/dunes.svg")',
    orbit: 'url("./wallpapers/orbit.svg")',
    horizon: 'url("./wallpapers/horizon.svg")',
    grove: 'url("./wallpapers/grove.svg")',
    upload: themeBackground,
  }
  return {
    '--bg': backgrounds[p.background], '--ink': p.theme === 'custom' ? p.customTextColor : t.ink,
    '--muted': p.theme === 'custom' ? `color-mix(in srgb, ${p.customTextColor} 78%, ${p.customSurfaceColor})` : t.muted,
    '--faint': p.theme === 'custom' ? `color-mix(in srgb, ${p.customTextColor} 68%, ${p.customSurfaceColor})` : t.faint,
    '--accent': p.theme === 'custom' ? p.accentColor : t.accent,
    '--surface': p.theme === 'custom' ? (p.surface === 'solid' ? p.customSurfaceColor : `color-mix(in srgb, ${p.customSurfaceColor} 88%, transparent)`) : (p.surface === 'solid' ? t.solidSurface : t.surface),
    '--panel': panel, '--panel-ink': panelInk, '--panel-accent': panelAccent,
    '--panel-muted': p.theme === 'custom' ? `color-mix(in srgb, ${panelInk} 78%, ${panel})` : t.muted,
    '--border': `color-mix(in srgb, ${p.theme === 'custom' ? p.customTextColor : t.ink} ${Math.round(p.borderIntensity * .36)}%, transparent)`,
    '--button': t.button, '--button-text': t.buttonText,
    '--shadow': `0 16px 45px rgba(0, 0, 0, ${p.shadowIntensity * .004})`, '--wallpaper-x': `${p.wallpaperX}%`, '--wallpaper-y': `${p.wallpaperY}%`, '--overlay': p.overlay / 100, '--brightness': p.brightness / 100, '--blur': `${p.blur}px`,
  } as CSSProperties
}
