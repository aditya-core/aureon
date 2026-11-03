import type { Theme } from '../lib/types'

export interface ThemeTokens {
  label: string; description: string; background: string; ink: string; muted: string; faint: string;
  accent: string; surface: string; solidSurface: string; border: string; button: string; buttonText: string; shadow: string
}
export const THEMES: Record<Theme, ThemeTokens> = {
  midnight: { label: 'Midnight', description: 'Quiet after hours', background: 'radial-gradient(ellipse at 50% 18%, #273348 0%, #131a28 54%, #0b111b 100%)', ink: '#f2f4fa', muted: '#bcc7d9', faint: '#93a2b8', accent: '#b5c1fc', surface: 'rgba(25, 34, 49, .72)', solidSurface: '#1c2637', border: 'rgba(204, 216, 241, .18)', button: '#d6def5', buttonText: '#1c2637', shadow: '0 16px 45px rgba(0, 0, 0, .15)' },
  dawn: { label: 'Dawn', description: 'A softer start', background: 'radial-gradient(ellipse at 55% 18%, #fffaf0 0%, #eee9e0 57%, #e3ded5 100%)', ink: '#292a28', muted: '#5f625e', faint: '#747a72', accent: '#607963', surface: 'rgba(255, 252, 246, .78)', solidSurface: '#fffaf2', border: 'rgba(66, 69, 60, .17)', button: '#344c3c', buttonText: '#ffffff', shadow: '0 16px 45px rgba(74, 65, 48, .08)' },
  aurora: { label: 'Aurora', description: 'A little wonder', background: 'radial-gradient(ellipse at 32% 35%, #1b7469 0%, transparent 49%), radial-gradient(ellipse at 78% 55%, #355f91 0%, transparent 55%), linear-gradient(135deg, #071b22, #20264e)', ink: '#f0f9f7', muted: '#c1dfdc', faint: '#a1c4c4', accent: '#a8f0d4', surface: 'rgba(11, 39, 48, .72)', solidSurface: '#143c46', border: 'rgba(214, 255, 249, .18)', button: '#c4f7e1', buttonText: '#113c34', shadow: '0 16px 45px rgba(0, 0, 0, .16)' },
  custom: { label: 'Custom', description: 'Make it yours', background: 'radial-gradient(ellipse at 50% 20%, #343047 0%, #171824 60%, #10121b 100%)', ink: '#f7f4fb', muted: '#d1c9db', faint: '#b2a8c0', accent: '#c5b2f1', surface: 'rgba(37, 31, 48, .78)', solidSurface: '#292333', border: 'rgba(239, 226, 255, .2)', button: '#e2d8f4', buttonText: '#292333', shadow: '0 16px 45px rgba(0, 0, 0, .16)' },
}
