import { Fragment, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Settings2, Sparkles } from 'lucide-react'
import { Clock } from './components/Clock'
import { Search } from './components/Search'
import { Shortcuts } from './components/Shortcuts'
import { usePreferences } from './hooks/usePreferences'
import { themeStyles } from './lib/theme-engine'
import { deleteWallpaper, getWallpaper, saveWallpaper } from './lib/wallpaper'

const Settings = lazy(() => import('./components/settings/Settings'))
const Workspace = lazy(() => import('./components/Workspace').then(module => ({ default: module.Workspace })))


export default function App() {
  const { preferences: p, update, status, ready } = usePreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wallpaper, setWallpaper] = useState<Blob | null>(null)
  const [wallpaperReady, setWallpaperReady] = useState(false)
  const [wallpaperError, setWallpaperError] = useState(false)
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null)
  const wallpaperVersion = useRef(0)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  useEffect(() => {
    // The default new tab does not need to open IndexedDB. Load the single
    // wallpaper only when it is selected or the settings panel needs it.
    if (!ready || wallpaperReady || (!settingsOpen && p.background !== 'upload')) return
    let active = true
    const version = wallpaperVersion.current
    const current = () => active && wallpaperVersion.current === version
    getWallpaper().then(blob => { if (current()) setWallpaper(blob) }).catch(() => { if (current()) setWallpaperError(true) }).finally(() => { if (current()) setWallpaperReady(true) })
    return () => { active = false }
  }, [ready, wallpaperReady, settingsOpen, p.background])
  useEffect(() => {
    if (!wallpaper) { setWallpaperUrl(null); return }
    const url = URL.createObjectURL(wallpaper)
    setWallpaperUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [wallpaper])
  const upload = async (file: File) => { await saveWallpaper(file); wallpaperVersion.current++; setWallpaper(file); setWallpaperReady(true); setWallpaperError(false); update({ background: 'upload' }) }
  const removeWallpaper = async () => { await deleteWallpaper(); wallpaperVersion.current++; setWallpaper(null); setWallpaperReady(true); setWallpaperError(false); if (p.background === 'upload') update({ background: 'theme' }) }
  const loaded = ready && (p.background !== 'upload' || (wallpaperReady && (!wallpaper || wallpaperUrl)))
  const styles = themeStyles(p) as CSSProperties & Record<string, string | number>
  if (p.background === 'upload' && wallpaperUrl) styles['--bg'] = `url("${wallpaperUrl}")`
  return <div className="app" data-theme={p.theme} data-background={p.background} data-layout={p.layout} data-spacing={p.spacing} data-alignment={p.alignment} data-motion={p.reducedMotion ? 'off' : p.animationIntensity} style={styles}>
    <div className="background-layer" aria-hidden="true"/><div className="background-overlay" aria-hidden="true"/>
    {!loaded ? <div className="loading-screen" role="status"><Sparkles size={20}/><span className="sr-only">Loading your space</span></div> : <>
      <header className="topbar">
        <a className="brand" href="./index.html" aria-label="NOVA new tab"><span className="brand-icon"><Sparkles size={16} strokeWidth={1.7}/></span><span>NOVA</span><span className="brand-divider"/><span className="brand-caption">YOUR SPACE TO THINK</span></a>
        <div className="top-actions"><span className="top-status"><span/> A LITTLE MORE CLARITY, EVERY DAY</span><button className="settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings2 size={17}/><span>Personalize</span></button></div>
      </header>
      <main className="main"><div className="main-inner">
        <div className="eyebrow"><span className="eyebrow-line"/> A FRESH START <span className="eyebrow-line"/></div>
        {p.sectionOrder.map(section => <Fragment key={section}>
          {section === 'clock' && p.visibleWidgets.includes('clock') && <Clock preferences={p}/>}
          {section === 'search' && <><Search engine={p.searchEngine}/><div className="search-hint">A little less noise. A little more focus.</div></>}
          {section === 'shortcuts' && p.visibleWidgets.includes('shortcuts') && <Shortcuts initialOrder={p.shortcutOrder}/>}
          {section === 'widgets' && (p.visibleWidgets.includes('notes') || p.visibleWidgets.includes('tasks') || p.visibleWidgets.includes('focus')) && <Suspense fallback={<p className="helper" role="status">Loading workspace…</p>}><Workspace visible={p.visibleWidgets} order={p.widgetOrder} sizes={p.widgetSizes}/></Suspense>}
        </Fragment>)}
      </div></main>
      <footer className="footer"><div><span className="footer-star">✳</span> MADE FOR A MORE MINDFUL INTERNET</div><div className="footer-right"><span className="status-dot"/> ALL YOURS, RIGHT HERE <span className="footer-separator">/</span> NOVA 02</div></footer>
      {(status === 'error' || (wallpaperError && p.background === 'upload') || (wallpaperReady && !wallpaper && p.background === 'upload')) && <div className="storage-warning" role="status">{status === 'error' ? 'Preferences couldn’t be saved or loaded. Please try again.' : 'Your wallpaper is unavailable. Showing the theme background.'}</div>}
      {settingsOpen && <Suspense fallback={<div className="settings-loading" role="status">Opening settings…</div>}><Settings preferences={p} update={update} status={status} close={closeSettings} upload={upload} removeWallpaper={removeWallpaper} hasWallpaper={!!wallpaper}/></Suspense>}
    </>}
  </div>
}
