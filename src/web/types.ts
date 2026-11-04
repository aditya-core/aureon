export type Font = 'system' | 'serif' | 'sans' | 'mono'
export interface SiteProfile {
  enabled: boolean
  auto: boolean
  distractions: boolean
  dark: { enabled: boolean; background: string; surface: string; text: string; link: string }
  typography: { enabled: boolean; font: Font; size: number; lineHeight: number; letterSpacing: number; width: number }
  reader: { font: Font; size: number; lineHeight: number; width: number; theme: 'warm' | 'light' | 'dark' }
  rules: { id: string; selector: string; enabled: boolean }[]
}
export interface Model {
  defaults(): SiteProfile
  normalize(value: unknown): SiteProfile
  originOf(url: string): string | null
  key(origin: string): string
  validSelector(value: unknown): boolean
  buildCSS(profile: unknown, hostname?: string): string
}
declare global { var NovaWebModel: Model }
