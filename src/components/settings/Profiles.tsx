import { useEffect, useState } from 'react'
import { captureCustomization } from '../../lib/studio'
import { getProfiles, MAX_PROFILES, saveProfiles } from '../../lib/profiles'
import type { EnvironmentProfile } from '../../lib/profiles'
import type { UserPreferences } from '../../lib/types'

interface Props { preferences: UserPreferences; update: (change: Partial<UserPreferences>) => void; hasWallpaper: boolean }
export function Profiles({ preferences, update, hasWallpaper }: Props) {
  const [profiles, setProfiles] = useState<EnvironmentProfile[]>([])
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { let active = true; getProfiles().then(value => { if (active) { setProfiles(value); setReady(true) } }).catch(() => { if (active) setError('Profiles could not be loaded. Your existing data was not changed.') }); return () => { active = false } }, [])
  async function persist(next: EnvironmentProfile[], success: string) {
    setBusy(true); setError(''); setMessage('')
    try { await saveProfiles(next); setProfiles(next); setMessage(success) } catch { setError('Could not save profiles. Please try again.') } finally { setBusy(false) }
  }
  function apply(profile: EnvironmentProfile) {
    const warning = profile.customization.background === 'upload' && !hasWallpaper ? ' Its uploaded wallpaper is missing on this device; the theme background will be shown.' : ''
    if (!window.confirm(`Apply ${profile.name}? Unsaved changes to the current look will be replaced.${warning}`)) return
    update(profile.customization); setError(''); setMessage(`${profile.name} applied. Check the settings save indicator.`)
  }
  return <><div className="content-heading"><span className="overline">ENVIRONMENT PROFILES</span><h3>A space for every mood</h3><p>Save a snapshot, then switch in a moment. Profiles share your notes, tasks, shortcuts and one local wallpaper.</p></div>
    {error && <p className="error-text" role="alert">{error}</p>}{message && <p className="studio-notice" role="status">{message}</p>}{!ready && !error && <p className="helper">Loading profiles…</p>}
    <div className="profile-list">{profiles.map(profile => <div className="profile-card" key={profile.id}><div><span className={`profile-dot profile-${profile.customization.theme}`}/><strong>{profile.name}</strong><small>{profile.customization.theme} · {profile.customization.layout}</small></div><div className="profile-actions"><button type="button" disabled={busy} onClick={() => apply(profile)}>Apply</button><button type="button" disabled={busy} aria-label={`Save current to ${profile.name}`} onClick={() => { if (window.confirm(`Replace ${profile.name} with your current customization?`)) void persist(profiles.map(item => item.id === profile.id ? { ...item, customization: captureCustomization(preferences) } : item), `${profile.name} saved locally.`) }}>Save current</button><button type="button" disabled={busy} aria-label={`Delete ${profile.name} profile`} onClick={() => { if (window.confirm(`Delete the ${profile.name} profile? Your current dashboard and data will remain.`)) void persist(profiles.filter(item => item.id !== profile.id), 'Profile removed.') }}>Delete</button></div></div>)}</div>
    {ready && profiles.length === 0 && <p className="empty-state">No profiles yet. Save this look as your first one.</p>}
    <form className="profile-create" onSubmit={event => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed || !ready || busy || profiles.length >= MAX_PROFILES) return; void persist([...profiles, { id: crypto.randomUUID(), name: trimmed, customization: captureCustomization(preferences) }], 'New profile saved locally.'); setName('') }}><label htmlFor="profile-name">Create a profile from this look</label><div><input id="profile-name" value={name} onChange={event => setName(event.target.value)} maxLength={30} placeholder="e.g. Deep work"/><button disabled={!ready || busy || !name.trim() || profiles.length >= MAX_PROFILES}>Save profile</button></div><small>Up to {MAX_PROFILES} profiles. Changes are not automatically saved back to a profile.</small></form>
  </>
}
