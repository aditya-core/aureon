import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Expand, Globe2, Layers2, Pin, Sparkles, X } from 'lucide-react'
import { useBrowser } from '../command/useBrowser'
import { focusTab } from '../command/api'
import { hostname, safeUrl } from '../command/model'

type Props = { onClose: () => void; onExpand: () => void }

/** A bounded, screenshot-free carousel backed by the same live snapshot as Tab Space. */
export default function Switcher({ onClose, onExpand }: Props) {
  const browser = useBrowser()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [brokenIcons, setBrokenIcons] = useState<Set<number>>(new Set())
  const dialog = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const resetClick = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tabs = useMemo(() => browser.tabs.filter(tab => !tab.incognito && tab.id !== undefined).sort((a, b) => (b.lastAccessed ?? -1) - (a.lastAccessed ?? -1) || a.windowId - b.windowId || a.index - b.index), [browser.tabs])
  const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.id === selectedId))
  const move = useCallback((direction: number) => {
    if (!tabs.length) return
    const next = tabs[Math.max(0, Math.min(tabs.length - 1, selectedIndex + direction))]
    const focusWasCard = document.activeElement instanceof HTMLElement && !!document.activeElement.closest('.switcher-card')
    setSelectedId(next.id!)
    if (focusWasCard) requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>(`[data-switcher-id="${next.id}"]`)?.focus())
  }, [selectedIndex, tabs])

  useEffect(() => {
    mounted.current = true
    dialog.current?.focus()
    return () => { mounted.current = false; if (resetClick.current) clearTimeout(resetClick.current) }
  }, [])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); return }
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')].filter(node => !node.hasAttribute('hidden'))
      if (!focusable.length) { event.preventDefault(); dialog.current.focus(); return }
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [move, onClose])

  async function openTab(tab: chrome.tabs.Tab) {
    if (busy || tab.id === undefined) return
    setBusy(true); setActionError('')
    try {
      const live = await chrome.tabs.get(tab.id)
      if (live.incognito) throw new Error('Private tabs are not available in this view.')
      await focusTab(live)
      if (mounted.current) onClose()
    } catch (error) {
      if (mounted.current) setActionError(`Could not finish switching; the tab may already be active. ${error instanceof Error ? error.message : 'It may have closed.'}`)
    } finally { if (mounted.current) setBusy(false) }
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    suppressClick.current = true
    move(dx < 0 ? 1 : -1)
    if (resetClick.current) clearTimeout(resetClick.current)
    resetClick.current = setTimeout(() => { suppressClick.current = false }, 0)
  }

  return <div className="switcher-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="switcher-dialog" role="dialog" aria-modal="true" aria-labelledby="switcher-title" aria-describedby="switcher-description" ref={dialog} tabIndex={-1}>
      <header className="switcher-header">
        <div className="switcher-brand"><span><Sparkles size={17}/></span><div><strong>NOVA</strong><small>QUICK SWITCHER</small></div></div>
        <div className="switcher-header-actions"><span className="switcher-live"><i/> YOUR OPEN TABS</span><button className="switcher-close" aria-label="Close tab switcher" onClick={onClose}><X size={19}/></button></div>
      </header>
      <div className="switcher-content">
        <div className="switcher-heading"><div><span className="switcher-kicker">A LITTLE MORE ROOM TO THINK</span><h1 id="switcher-title">Pick up where you <em>left off.</em></h1><p id="switcher-description">Your open Chrome tabs, in one calm place.</p></div><div className="switcher-count"><Layers2 size={16}/><span>{browser.ready && browser.available ? tabs.length : '—'} <small>open tabs</small></span></div></div>
        {!browser.available ? <div className="switcher-empty switcher-preview" role="status"><div className="switcher-preview-deck" aria-hidden="true"><div className="switcher-preview-card side left"/><div className="switcher-preview-card side right"/><div className="switcher-preview-card center"><div className="switcher-preview-top"><span>✳</span><i/><i/></div><div className="switcher-preview-art"><span>✳</span></div><div className="switcher-preview-lines"><strong>YOUR TABS</strong><i/><i/></div></div></div><strong>Made for your browser.</strong><p>Open NOVA in Chrome to switch between your real tabs. No example tabs are shown here.</p></div> : !browser.ready ? <div className="switcher-empty" role="status"><span><Layers2 size={23}/></span><strong>Gathering your tabs…</strong></div> : browser.error ? <div className="switcher-empty" role="alert"><span><Globe2 size={23}/></span><strong>Tabs are unavailable.</strong><p>{browser.error}</p><button onClick={() => void browser.refresh()}>Try again</button></div> : !tabs.length ? <div className="switcher-empty"><span><Globe2 size={23}/></span><strong>No tabs to show yet.</strong><p>Open a normal Chrome tab and it will appear here.</p></div> : <>
          <div className="switcher-deck" aria-label="Recent Chrome tabs" onPointerDown={event => { pointerStart.current = { x: event.clientX, y: event.clientY }; suppressClick.current = false }} onPointerUp={pointerUp} onPointerCancel={() => { pointerStart.current = null }}>
            {tabs.slice(Math.max(0, selectedIndex - 2), Math.min(tabs.length, selectedIndex + 3)).map((tab, offsetIndex) => {
              const index = Math.max(0, selectedIndex - 2) + offsetIndex, offset = index - selectedIndex
              const title = tab.title || hostname(tab.url), domain = hostname(tab.url), safe = safeUrl(tab.url)
              const icon = safe && !brokenIcons.has(tab.id!) ? `${chrome.runtime.getURL('_favicon/')}?pageUrl=${encodeURIComponent(safe)}&size=32` : null
              return <button key={tab.id} data-switcher-id={tab.id} className={`switcher-card ${offset === 0 ? 'is-centered' : ''}`} style={{ transform: `translateX(${offset * 55 - 50}%) scale(${1 - Math.abs(offset) * .075})`, opacity: 1 - Math.abs(offset) * .14, zIndex: 5 - Math.abs(offset) }} aria-label={`Switch to ${title}`} aria-current={offset === 0 ? 'true' : undefined} disabled={busy} onClick={() => { if (!suppressClick.current) void openTab(tab) }}>
                <div className="switcher-card-top"><span className="switcher-card-icon">{icon ? <img src={icon} alt="" onError={() => setBrokenIcons(previous => new Set(previous).add(tab.id!))}/> : <Globe2 size={17}/>}</span><span className="switcher-card-site"><strong>{domain}</strong><small>Window {tab.windowId}</small></span><ArrowUpRight size={16}/></div>
                <div className="switcher-card-art" aria-hidden="true"><span className="switcher-art-orbit one"/><span className="switcher-art-orbit two"/><span className="switcher-art-mark">{domain === 'Browser page' ? '✳' : domain.slice(0, 1).toUpperCase()}</span><span className="switcher-art-caption">YOUR SPACE TO THINK <span>✳</span></span></div>
                <div className="switcher-card-body"><span className="switcher-card-label">{tab.active ? 'ACTIVE TAB' : 'OPEN TAB'}{tab.pinned && <><span> / </span> PINNED</>}</span><strong>{title}</strong><small>{domain}</small><span className="switcher-card-bottom">{tab.pinned ? <Pin size={13}/> : <span className="switcher-dot"/>} <span>{tab.pinned ? 'Kept close' : 'Ready when you are'}</span><ArrowUpRight size={14}/></span></div>
              </button>
            })}
          </div>
          <div className="switcher-controls"><button aria-label="Previous tab" disabled={selectedIndex === 0 || busy} onClick={() => move(-1)}><ArrowLeft size={17}/></button><div className="switcher-position" aria-live="polite"><strong>{String(selectedIndex + 1).padStart(2, '0')}</strong><span>/</span>{String(tabs.length).padStart(2, '0')}<small>SWIPE OR USE ARROW KEYS</small></div><button aria-label="Next tab" disabled={selectedIndex >= tabs.length - 1 || busy} onClick={() => move(1)}><ArrowRight size={17}/></button></div>
        </>}
        {actionError && <div className="switcher-error" role="alert">{actionError}</div>}
        <div className="switcher-divider"/>
        <div className="switcher-bottom"><div><span className="switcher-mini-icon"><Layers2 size={18}/></span><div><strong>Need the bigger picture?</strong><p>Search, organize and manage all your tabs in Tab Space.</p></div></div><button className="switcher-expand" onClick={onExpand}><Expand size={15}/> Open Tab Space <ArrowUpRight size={15}/></button></div>
        <div className="switcher-footnote"><span><ArrowDownLeft size={13}/> PRIVATE TABS EXCLUDED</span><span>NO SCREENSHOTS CAPTURED</span></div>
      </div>
    </div>
  </div>
}
