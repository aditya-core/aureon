import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowUpRight, Settings2, Sparkles } from 'lucide-react'
import { Clock } from './components/Clock'
import { Search } from './components/Search'
import { Workspace } from './components/Workspace'
import { usePreferences } from './hooks/usePreferences'
import { themeStyles } from './lib/theme-engine'
import { deleteWallpaper, getWallpaper, saveWallpaper } from './lib/wallpaper'

const Settings = lazy(() => import('./components/settings/Settings'))
const links = [
  { label: 'Google', url: 'https://www.google.com', mark: 'G' },
  { label: 'YouTube', url: 'https://www.youtube.com', mark: '▶' },
  { label: 'Gmail', url: 'https://mail.google.com', mark: 'M' },
  { label: 'GitHub', url: 'https://github.com', mark: '⌘' },
]

export default function App() {
  const { preferences: p, update, status, ready } = usePreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [wallpaper, setWallpaper] = useState<Blob | null>(null)
  const [wallpaperReady, setWallpaperReady] = useState(false)
  const [wallpaperError, setWallpaperError] = useState(false)
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  useEffect(() => {
    let active = true
    getWallpaper().then(blob => { if (active) setWallpaper(blob) }).catch(() => { if (active) setWallpaperError(true) }).finally(() => { if (active) setWallpaperReady(true) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!wallpaper) { setWallpaperUrl(null); return }
    const url = URL.createObjectURL(wallpaper)
    setWallpaperUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [wallpaper])
  const upload = async (file: File) => { await saveWallpaper(file); setWallpaper(file); setWallpaperError(false); update({ background: 'upload' }) }
  const removeWallpaper = async () => { await deleteWallpaper(); setWallpaper(null); if (p.background === 'upload') update({ background: 'theme' }) }
  const loaded = ready && (p.background !== 'upload' || (wallpaperReady && (!wallpaper || wallpaperUrl)))
  const styles = themeStyles(p) as CSSProperties & Record<string, string | number>
  if (p.background === 'upload' && wallpaperUrl) styles['--bg'] = `url("${wallpaperUrl}")`
  return <div className="app" data-theme={p.theme} data-background={p.background} data-layout={p.layout} data-spacing={p.spacing} data-motion={p.reducedMotion ? 'off' : p.animationIntensity} style={styles}>
    <div className="background-layer" aria-hidden="true"/><div className="background-overlay" aria-hidden="true"/>
    {!loaded ? <div className="loading-screen" role="status"><Sparkles size={20}/><span className="sr-only">Loading your space</span></div> : <>
      <header className="topbar">
        <a className="brand" href="./index.html" aria-label="NOVA new tab"><span className="brand-icon"><Sparkles size={16} strokeWidth={1.7}/></span><span>NOVA</span><span className="brand-divider"/><span className="brand-caption">YOUR SPACE TO THINK</span></a>
        <div className="top-actions"><span className="top-status"><span/> A LITTLE MORE CLARITY, EVERY DAY</span><button className="settings-trigger" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings2 size={17}/><span>Personalize</span></button></div>
      </header>
      <main className="main"><div className="main-inner">
        <div className="eyebrow"><span className="eyebrow-line"/> A FRESH START <span className="eyebrow-line"/></div>
        {p.visibleWidgets.includes('clock') && <Clock preferences={p}/>}
        <Search engine={p.searchEngine}/><div className="search-hint">A little less noise. A little more focus.</div>
        {p.visibleWidgets.includes('shortcuts') && <section className="quick-access" aria-labelledby="quick-title"><div className="section-heading"><h2 id="quick-title">QUICK ACCESS</h2><span>YOUR EVERYDAY ESSENTIALS</span></div><div className="quick-grid">{p.shortcutOrder.map(name => { const link = links.find(item => item.label === name); return link ? <a key={link.label} className="quick-link" href={link.url}><span className="quick-icon">{link.mark}</span><span className="quick-label">{link.label}</span><ArrowUpRight className="quick-arrow" size={14} aria-hidden="true"/></a> : null })}</div></section>}
        {(p.visibleWidgets.includes('notes') || p.visibleWidgets.includes('tasks')) && <Workspace visible={p.visibleWidgets}/>}
      </div></main>
      <footer className="footer"><div><span className="footer-star">✳</span> MADE FOR A MORE MINDFUL INTERNET</div><div className="footer-right"><span className="status-dot"/> ALL YOURS, RIGHT HERE <span className="footer-separator">/</span> NOVA 02</div></footer>
      {(status === 'error' || (wallpaperError && p.background === 'upload') || (wallpaperReady && !wallpaper && p.background === 'upload')) && <div className="storage-warning" role="status">{status === 'error' ? 'Preferences couldn’t be saved or loaded. Please try again.' : 'Your wallpaper is unavailable. Showing the theme background.'}</div>}
      {settingsOpen && <Suspense fallback={<div className="settings-loading" role="status">Opening settings…</div>}><Settings preferences={p} update={update} status={status} close={closeSettings} upload={upload} removeWallpaper={removeWallpaper} hasWallpaper={!!wallpaper}/></Suspense>}
    </>}
  </div>
}
