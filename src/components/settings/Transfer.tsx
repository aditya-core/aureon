import { useState } from 'react'
import { exportCustomization, MAX_IMPORT_BYTES, parseCustomization } from '../../lib/studio'
import type { UserPreferences } from '../../lib/types'

interface Props { preferences: UserPreferences; update: (change: Partial<UserPreferences>) => void; hasWallpaper: boolean }
export function Transfer({ preferences, update, hasWallpaper }: Props) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([exportCustomization(preferences)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'nova-customization.json'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Customization export prepared.'); setError('')
    } catch { setError('Could not export your customization.') }
  }
  async function importFile(file: File) {
    setError(''); setMessage('')
    if (file.size === 0 || file.size > MAX_IMPORT_BYTES) { setError('Choose a JSON file smaller than 128 KB.'); return }
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const config = parseCustomization(parsed)
      const warning = config.background === 'upload' && !hasWallpaper ? ' The saved wallpaper is not included and is missing on this device.' : ''
      if (!window.confirm(`Apply this customization? Your current appearance and layout will be replaced; productivity data will not change.${warning}`)) return
      update(config); setMessage('Customization applied. Check the settings save indicator.')
    } catch { setError('This file is invalid or unsupported. No settings were changed.') }
  }
  return <><div className="content-heading"><span className="overline">IMPORT & EXPORT</span><h3>Take your look with you</h3><p>Move your customization between devices with a small, validated JSON file.</p></div><div className="transfer-card"><strong>What’s included</strong><p>Theme, colors, background selection, layout, visibility and motion. Notes, tasks, shortcuts, name, profiles and wallpaper image bytes stay on this device.</p><button className="secondary-button" onClick={download}>Export customization</button></div><div className="transfer-card"><strong>Bring a look back</strong><p>Only NOVA version 1 customization files under 128 KB are accepted. Uploaded images must be added separately.</p><label className="upload-button">Import customization<input type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }}/></label></div>{message && <p className="studio-notice" role="status">{message}</p>}{error && <p className="error-text" role="alert">{error}</p>}</>
}
