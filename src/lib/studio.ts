import { DEFAULT_PREFERENCES } from './defaults'
import { normalizePreferences } from './storage'
import type { UserPreferences } from './types'

// This is deliberately an allowlist: productivity data, names, and image bytes
// never enter a profile or exported configuration.
export const CUSTOMIZATION_KEYS = [
  'theme', 'accentColor', 'background', 'backgroundColor', 'customTextColor', 'customSurfaceColor',
  'gradientStart', 'gradientEnd', 'gradientAngle', 'borderIntensity', 'shadowIntensity',
  'wallpaperX', 'wallpaperY', 'overlay', 'brightness', 'blur', 'surface', 'alignment',
  'sectionOrder', 'widgetSizes', 'layout', 'spacing', 'visibleWidgets', 'widgetOrder',
  'animationIntensity', 'reducedMotion', 'clockFormat', 'showSeconds', 'greetingEnabled', 'searchEngine',
] as const satisfies readonly (keyof UserPreferences)[]
export type Customization = Pick<UserPreferences, typeof CUSTOMIZATION_KEYS[number]>
export const MAX_IMPORT_BYTES = 128 * 1024

export function captureCustomization(p: UserPreferences): Customization {
  const result = {} as Customization
  for (const key of CUSTOMIZATION_KEYS) {
    // Copy mutable containers so future edits cannot change a saved snapshot.
    Object.assign(result, { [key]: Array.isArray(p[key]) ? [...p[key]] : key === 'widgetSizes' ? { ...p.widgetSizes } : p[key] })
  }
  return result
}
export function exportCustomization(p: UserPreferences): string {
  return JSON.stringify({ format: 'nova-customization', version: 1, customization: captureCustomization(p) }, null, 2)
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
const choices = (value: unknown, options: readonly string[]) => typeof value === 'string' && options.includes(value)
const bounded = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const uniqueList = (value: unknown, options: readonly string[], full: boolean) => Array.isArray(value) && value.every(item => choices(item, options)) && new Set(value).size === value.length && (!full || value.length === options.length)
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

// Reject malformed/incomplete imports instead of silently filling fields with defaults.
// No user-provided CSS, arbitrary URLs, unknown fields or prototype keys are accepted.
export function parseCustomization(input: unknown): Customization {
  if (!record(input) || input.format !== 'nova-customization' || input.version !== 1 || Object.keys(input).some(k => !['format', 'version', 'customization'].includes(k)) || !record(input.customization)) throw new Error('Not a supported NOVA customization file.')
  const v = input.customization
  if (Object.keys(v).length !== CUSTOMIZATION_KEYS.length || Object.keys(v).some(key => !(CUSTOMIZATION_KEYS as readonly string[]).includes(key))) throw new Error('Customization fields are missing or unrecognized.')
  const colors = ['accentColor', 'backgroundColor', 'customTextColor', 'customSurfaceColor', 'gradientStart', 'gradientEnd']
  const ranges: Record<string, [number, number]> = { gradientAngle: [0, 360], borderIntensity: [0, 100], shadowIntensity: [0, 100], wallpaperX: [0, 100], wallpaperY: [0, 100], overlay: [0, 80], brightness: [40, 120], blur: [0, 12] }
  const sizes = v.widgetSizes
  if (!colors.every(key => color(v[key])) || !Object.entries(ranges).every(([key, range]) => bounded(v[key], ...range)) ||
    !choices(v.theme, ['midnight', 'dawn', 'aurora', 'custom']) || !choices(v.background, ['theme', 'solid', 'mist', 'aurora', 'dunes', 'orbit', 'horizon', 'grove', 'upload']) ||
    !choices(v.surface, ['soft', 'solid']) || !choices(v.alignment, ['center', 'left']) || !choices(v.layout, ['focus', 'workspace', 'immersive']) ||
    !choices(v.spacing, ['compact', 'comfortable']) || !choices(v.animationIntensity, ['off', 'subtle', 'standard', 'expressive']) ||
    !choices(v.clockFormat, ['12h', '24h']) || !choices(v.searchEngine, ['google', 'duckduckgo', 'bing']) ||
    typeof v.reducedMotion !== 'boolean' || typeof v.showSeconds !== 'boolean' || typeof v.greetingEnabled !== 'boolean' ||
    !uniqueList(v.sectionOrder, ['clock', 'search', 'shortcuts', 'widgets'], true) || !uniqueList(v.widgetOrder, ['notes', 'tasks', 'focus'], true) ||
    !uniqueList(v.visibleWidgets, ['clock', 'shortcuts', 'notes', 'tasks', 'focus', 'bookmarks'], false) || !record(sizes) ||
    Object.keys(sizes).length !== 3 || !['notes', 'tasks', 'focus'].every(k => Object.hasOwn(sizes, k) && choices(sizes[k], ['normal', 'wide']))) throw new Error('Some customization values are invalid.')
  // Normalize into fresh objects using only validated allowlisted keys.
  return captureCustomization(normalizePreferences({ ...DEFAULT_PREFERENCES, ...v }))
}
