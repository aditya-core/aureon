import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { getCollections, getPages, importResearchBackup } from './db'
import { createResearchBackup, MAX_BACKUP_BYTES, parseResearchBackup } from './transfer'

export function BackupTools({ onImported, report }: { onImported: () => Promise<void>; report: (message: string, error?: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const [collections, pages] = await Promise.all([getCollections(), getPages()])
      const content = createResearchBackup(collections, pages)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `nova-research-${new Date().toISOString().slice(0,10)}.json`; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      report(`Backup prepared: ${pages.length} pages and ${collections.length} collections. Keep the file somewhere private.`)
    } catch (error) { report(error instanceof Error ? error.message : 'Could not export research.', true) } finally { setBusy(false) }
  }
  async function upload(file: File) {
    setBusy(true)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is larger than 5 MB. Nothing was imported.')
      const backup = parseResearchBackup(await file.text())
      if (!window.confirm(`Import ${backup.pages.length} pages and ${backup.collections.length} collections? Existing pages are not overwritten; matching URLs are skipped.`)) return
      const result = await importResearchBackup(backup)
      try { await onImported() } catch { report('Import completed, but the library could not refresh. Reload the page to see it.', true); return }
      report(`Imported ${result.pages} pages and ${result.collections} collections; skipped ${result.skipped} matching pages.`)
    } catch (error) { report(error instanceof Error ? error.message : 'Could not import research. Nothing was changed.', true) } finally { setBusy(false) }
  }
  return <details className="r-backup"><summary>Back up or restore your library</summary><p>Research is stored on this device and can be lost if the extension is removed. Export an unencrypted JSON backup to a safe place. It includes your URLs, notes and cards—not NOVA’s stored AI account token.</p><div className="r-actions"><button disabled={busy} onClick={() => void download()}><Download size={14}/> Export backup</button><label className={`r-file ${busy ? 'disabled' : ''}`}><Upload size={14}/> Import backup<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file) }}/></label></div><small>Imports merge into your library and never overwrite matching pages. Limit: 5 MB, 1,000 collections and 5,000 pages. Pages with missing collections become unfiled.</small></details>
}
