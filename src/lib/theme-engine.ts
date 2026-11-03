import type { CSSProperties } from 'react'
import { THEMES } from '../config/themes'
import type { UserPreferences } from './types'

export function themeStyles(p: UserPreferences): CSSProperties {
  const t = THEMES[p.theme]
  const backgrounds: Record<string, string> = {
    theme: t.background,
    solid: p.backgroundColor,
    mist: 'radial-gradient(ellipse at 30% 25%, #53567a, transparent 60%), linear-gradient(145deg, #121a28, #263548)',
    aurora: 'radial-gradient(ellipse at 30% 35%, #1c806c, transparent 50%), radial-gradient(ellipse at 75% 58%, #315d98, transparent 55%), #0b1b2a',
    dunes: 'url("./wallpapers/dunes.svg")',
    orbit: 'url("./wallpapers/orbit.svg")',
    upload: t.background,
  }
  return {
    '--bg': backgrounds[p.background], '--ink': t.ink, '--muted': t.muted, '--faint': t.faint,
    '--accent': p.theme === 'custom' ? p.accentColor : t.accent, '--surface': p.surface === 'solid' ? t.solidSurface : t.surface,
    '--panel': t.solidSurface, '--border': t.border, '--button': t.button, '--button-text': t.buttonText,
    '--shadow': t.shadow, '--overlay': p.overlay / 100, '--brightness': p.brightness / 100, '--blur': `${p.blur}px`,
  } as CSSProperties
}
