import { DEFAULT_PREFERENCES } from './defaults'
import { getStoredProfiles, saveStoredProfiles } from './storage'
import { captureCustomization, parseCustomization } from './studio'
import type { Customization } from './studio'

export interface EnvironmentProfile { id: string; name: string; customization: Customization }
export const MAX_PROFILES = 20
export function starterProfiles(): EnvironmentProfile[] {
  return [
    { id: 'work', name: 'Work', customization: captureCustomization({ ...DEFAULT_PREFERENCES, layout: 'workspace', visibleWidgets: ['clock', 'shortcuts', 'notes', 'tasks', 'focus'] }) },
    { id: 'study', name: 'Study', customization: captureCustomization({ ...DEFAULT_PREFERENCES, theme: 'aurora', layout: 'workspace', visibleWidgets: ['clock', 'shortcuts', 'notes', 'tasks', 'focus'] }) },
    { id: 'personal', name: 'Personal', customization: captureCustomization({ ...DEFAULT_PREFERENCES, theme: 'dawn', layout: 'immersive' }) },
  ]
}
export async function getProfiles(): Promise<EnvironmentProfile[]> {
  const raw = await getStoredProfiles()
  if (raw === undefined) return starterProfiles()
  if (!Array.isArray(raw) || raw.length > MAX_PROFILES) throw new Error('Profile storage is invalid')
  const seen = new Set<string>()
  return raw.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 80 || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 30) throw new Error('Profile storage is invalid')
    seen.add(item.id)
    return { id: item.id, name: item.name, customization: parseCustomization({ format: 'nova-customization', version: 1, customization: item.customization }) }
  })
}
export async function saveProfiles(profiles: EnvironmentProfile[]): Promise<void> {
  if (profiles.length > MAX_PROFILES) throw new Error('Too many profiles')
  await saveStoredProfiles(profiles)
}
