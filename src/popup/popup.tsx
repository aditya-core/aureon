import { useEffect, useState } from 'react'
import { BookOpen, EyeOff, LayoutGrid, Moon, Settings2, Sparkles, Type, Library } from 'lucide-react'
import type { Font, SiteProfile } from '../web/types'
import { applyProfile, disableAutomatic, enableAutomatic, ensureContent, matchPattern } from '../web/chrome'

const M = globalThis.NovaWebModel
function Toggle({ label, detail, checked, disabled, onChange }: { label: string; detail: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle"><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)}/></label>
}
export function Popup() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  const [profile, setProfile] = useState<SiteProfile>(() => M.defaults())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<'colors' | 'type' | 'rules' | null>(null)
  const [draft, setDraft] = useState<SiteProfile>(() => M.defaults())
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [current] = await chrome.tabs.query({ active: true, currentWindow: true })
      const site = current?.url ? M.originOf(current.url) : null
      if (!alive) return
      setTab(current ?? null); setOrigin(site)
      if (!site || current?.id === undefined) return
      const key = M.key(site); const result = await chrome.storage.local.get(key); let saved = M.normalize(result[key])
      if (saved.auto) {
        const pattern = matchPattern(site)
        if (!pattern || !await chrome.permissions.contains({ origins: [pattern] })) saved = { ...saved, auto: false }
      }
      if (!alive) return
      setProfile(saved); setDraft(saved)
      try { const status = await chrome.tabs.sendMessage(current.id, { type: 'NOVA_WEB_STATUS' }) as { active?: boolean }; if (alive) setApplied(status?.active === true) } catch { /* no content script on this tab */ }
    })().catch(() => { if (alive) setError('Could not load the current site. Open a normal HTTP or HTTPS page and try again.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  const unsupported = !origin || tab?.id === undefined
  async function commit(next: SiteProfile): Promise<boolean> {
    if (!origin || tab?.id === undefined) return false
    setBusy(true); setError(''); setNotice('')
    const safe = M.normalize(next)
    try {
      await chrome.storage.local.set({ [M.key(origin)]: safe })
      setProfile(safe); setDraft(safe)
      const active = await applyProfile(tab.id, safe)
      setApplied(active); setNotice('Saved locally for this site.'); return true
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update this page. Some protected pages cannot be modified.'); return false }
    finally { setBusy(false) }
  }
  async function applyNow() {
    if (tab?.id === undefined) return
    setBusy(true); setError(''); setNotice('')
    try { const active = await applyProfile(tab.id, profile); setApplied(active); setNotice(active ? 'Saved styling applied to this tab.' : 'No styling is enabled in this profile.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not apply styling to this page.') }
    finally { setBusy(false) }
  }
  async function automatic(checked: boolean) {
    if (!origin || tab?.id === undefined) return
    const pattern = matchPattern(origin)
    if (!pattern) { setError('Automatic access is unavailable for custom ports. Current-tab controls still work.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      if (checked) {
        // permission prompt is invoked directly by the user click, before other asynchronous work.
        if (!await enableAutomatic(pattern)) { setError('Permission was not granted. Current-tab controls still work.'); return }
        const next = { ...profile, auto: true }
        try { await chrome.storage.local.set({ [M.key(origin)]: next }) } catch (e) { await disableAutomatic(pattern); throw e }
        setProfile(next); setDraft(next)
        setNotice('Automatic styling enabled for this origin. Enable site styling to apply it.')
      } else {
        const next = { ...profile, auto: false }
        await chrome.storage.local.set({ [M.key(origin)]: next }); setProfile(next); setDraft(next)
        await disableAutomatic(pattern)
        setNotice('Automatic site access removed. Current-tab styling remains until disabled or reloaded.')
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update site permission.') }
    finally { setBusy(false) }
  }
  async function reader() {
    if (tab?.id === undefined) return
    setBusy(true); setError(''); setNotice('')
    try {
      await ensureContent(tab.id)
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['web/reader.js'] })
      const result = await chrome.tabs.sendMessage(tab.id, { type: 'NOVA_WEB_READER', options: profile.reader }) as { open?: boolean; error?: string }
      if (result?.error) throw new Error(result.error)
      setNotice(result?.open ? 'Reader is open on the page. Press Escape or Exit reader to close.' : 'Reader closed.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Reader could not open on this page.') }
    finally { setBusy(false) }
  }
  async function picker() {
    if (tab?.id === undefined) return
    setBusy(true); setError('')
    try {
      if ((!profile.enabled || !profile.distractions) && !await commit({ ...profile, enabled: true, distractions: true })) return
      await ensureContent(tab.id)
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['web/picker.js'] })
      window.close()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start selection on this page.') }
    finally { setBusy(false) }
  }
  const noActions = loading || unsupported || busy
  const activeStatus = applied ? 'Styling active in this tab' : profile.enabled ? 'Saved profile · not active in this tab' : 'Styling off'
  return <main className="popup">
    <header><div className="brand"><span className="mark"><Sparkles size={16}/></span><strong>NOVA <span>WEB</span></strong></div><span className="local">LOCAL FIRST</span></header>
    <button className="command-link" disabled={tab?.windowId === undefined} onClick={() => { if (tab?.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => setError('Could not open Assistant. Check Chrome side panel support.')) }}><Sparkles size={17}/><span><strong>NOVA Assistant</strong><small>Think through what you’re reading</small></span><span aria-hidden="true">↗</span></button>
    <button className="command-link" onClick={() => { const id = tab?.id; void chrome.tabs.create({ url: chrome.runtime.getURL(`research.html${id === undefined ? '' : `?tab=${id}`}`) }).catch(() => setError('Could not open Research.')) }}><Library size={17}/><span><strong>Research workspace</strong><small>Collect pages and ideas locally</small></span><span aria-hidden="true">↗</span></button>
    <button className="command-link" onClick={() => { void chrome.tabs.create({ url: chrome.runtime.getURL('command.html') }).catch(() => setError('Could not open Command Centre.')) }}><LayoutGrid size={17}/><span><strong>Command Centre</strong><small>Organize tabs & workspaces</small></span><span aria-hidden="true">↗</span></button>
    <div className="hero"><span className="eyebrow">YOUR INTERNET, REIMAGINED</span><h1>A little more <em>you.</em></h1><p>Thoughtful controls for the page you’re on.</p></div>
    <section className="site"><div><span className="caption">CURRENT WEBSITE</span><strong title={origin ?? ''}>{loading ? 'Finding your page…' : origin ? new URL(origin).host : 'Unsupported page'}</strong><small>{loading ? 'Checking access' : unsupported ? 'Open a regular HTTP or HTTPS page.' : activeStatus}</small></div><span className={`status ${applied ? 'on' : ''}`}/></section>
    {error && <p className="message error" role="alert">{error}</p>}{notice && <p className="message" role="status">{notice}</p>}
    <Toggle label="NOVA on this site" detail="Enable or restore this site’s styling" checked={profile.enabled} disabled={noActions} onChange={checked => void commit({ ...profile, enabled: checked })}/>
    {profile.enabled && !applied && <button className="apply-current" disabled={noActions} onClick={() => void applyNow()}>Apply saved styling to this tab</button>}
    <div className="control-title">QUICK CONTROLS <Settings2 size={14}/></div>
    <div className="control"><Moon size={17}/><Toggle label="Dark mode" detail="Best effort, no image inversion" checked={profile.dark.enabled && profile.enabled} disabled={noActions} onChange={checked => void commit({ ...profile, enabled: checked || profile.enabled, dark: { ...profile.dark, enabled: checked } })}/><button disabled={noActions} className="more" aria-label="Dark mode colors" onClick={() => { setDraft(profile); setEditor(editor === 'colors' ? null : 'colors') }}>Edit</button></div>
    {editor === 'colors' && <div className="editor">{(['background','surface','text','link'] as const).map(key => <label key={key}>{key}<input type="color" value={draft.dark[key]} onChange={e => setDraft({ ...draft, dark: { ...draft.dark, [key]: e.target.value } })}/></label>)}<button disabled={noActions} onClick={() => { void commit({ ...draft, enabled: true, dark: { ...draft.dark, enabled: true } }); setEditor(null) }}>Apply colors</button></div>}
    <div className="control"><Type size={17}/><Toggle label="Typography" detail="Local fonts and comfortable spacing" checked={profile.typography.enabled && profile.enabled} disabled={noActions} onChange={checked => void commit({ ...profile, enabled: checked || profile.enabled, typography: { ...profile.typography, enabled: checked } })}/><button disabled={noActions} className="more" aria-label="Typography settings" onClick={() => { setDraft(profile); setEditor(editor === 'type' ? null : 'type') }}>Edit</button></div>
    {editor === 'type' && <div className="editor"><label>Font<select value={draft.typography.font} onChange={e => setDraft({ ...draft, typography: { ...draft.typography, font: e.target.value as Font } })}>{['system','serif','sans','mono'].map(x => <option key={x}>{x}</option>)}</select></label>{([['size','Size',12,30,1],['lineHeight','Line height',1,2.5,.1],['letterSpacing','Letter spacing',-1,3,.1],['width','Article width',450,1600,50]] as const).map(([key,label,min,max,step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={draft.typography[key]} onChange={e => setDraft({ ...draft, typography: { ...draft.typography, [key]: Number(e.target.value) } })}/></label>)}<button disabled={noActions} onClick={() => { void commit({ ...draft, enabled: true, typography: { ...draft.typography, enabled: true } }); setEditor(null) }}>Apply typography</button></div>}
    <div className="control action"><BookOpen size={17}/><span><strong>Reader mode</strong><small>Open a clean article view</small></span><button className="more" disabled={noActions} onClick={() => void reader()}>Open / exit</button></div>
    <div className="control"><EyeOff size={17}/><Toggle label="Distraction control" detail="Apply saved hiding rules" checked={profile.enabled && profile.distractions} disabled={noActions} onChange={checked => void commit({ ...profile, enabled: checked || profile.enabled, distractions: checked })}/><button className="more" disabled={noActions} onClick={() => void picker()}>Select</button><button className="more" disabled={noActions} onClick={() => setEditor(editor === 'rules' ? null : 'rules')}>Rules ({profile.rules.length})</button></div>
    {editor === 'rules' && <div className="rules">{profile.rules.length === 0 ? <p>No hidden elements yet.</p> : profile.rules.map(rule => <div key={rule.id}><label><input type="checkbox" checked={rule.enabled} disabled={noActions} onChange={e => void commit({ ...profile, rules: profile.rules.map(r => r.id === rule.id ? { ...r, enabled: e.target.checked } : r) })}/><code title={rule.selector}>{rule.selector}</code></label><button disabled={noActions} aria-label={`Remove rule ${rule.selector}`} onClick={() => void commit({ ...profile, rules: profile.rules.filter(r => r.id !== rule.id) })}>Undo</button></div>)}</div>}
    <section className="permission"><Toggle label="Apply automatically on this site" detail="Optional permission for this host and scheme" checked={profile.auto} disabled={noActions} onChange={checked => void automatic(checked)}/><p>Without this permission, changes apply only to the current tab until it navigates. Chrome host grants include all ports. Internal and some protected pages cannot be modified.</p></section>
    <button className="reset" disabled={noActions} onClick={() => { if (window.confirm('Reset this website’s NOVA settings and revoke automatic access?')) void (async () => { if (profile.auto && origin) { const pattern = matchPattern(origin); if (pattern) { try { await disableAutomatic(pattern) } catch { setError('Could not revoke site access. Check Chrome extension permissions.'); return } } } await commit(M.defaults()) })() }}>Reset this site</button>
    <footer>NO PAGE CONTENT LEAVES YOUR DEVICE <span>✳</span></footer>
  </main>
}
