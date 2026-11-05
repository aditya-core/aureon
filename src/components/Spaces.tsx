import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Boxes, Library, Sparkles } from 'lucide-react'

/** A small, opt-in launcher; feature pages remain separate Vite entries. */
export function Spaces() {
  const [open, setOpen] = useState(false)
  const [windowId, setWindowId] = useState<number | undefined>()
  const [message, setMessage] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const installed = typeof chrome !== 'undefined' && !!chrome.runtime?.id
  useEffect(() => {
    if (!installed || !chrome.windows?.getCurrent) return
    let active = true
    void chrome.windows.getCurrent().then(window => { if (active) setWindowId(window.id) }).catch(() => { if (active) setMessage('Open NOVA from the browser toolbar to access the Assistant.') })
    return () => { active = false }
  }, [installed])
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [open])
  function openAssistant() {
    if (windowId === undefined || !chrome.sidePanel?.open) { setMessage('Open the Assistant from the NOVA toolbar popup.'); return }
    // Keep this call synchronous with the click so Chrome preserves the user gesture.
    void chrome.sidePanel.open({ windowId }).then(() => { setOpen(false); setMessage('To share a page, first click NOVA on that page in the browser toolbar.') }).catch(() => setMessage('Could not open the side panel. Try the NOVA toolbar popup.'))
  }
  return <div className="spaces" ref={root}>
    <button ref={trigger} className="spaces-trigger" aria-label="Explore NOVA" onClick={() => { setOpen(value => !value); setMessage('') }} aria-expanded={open} aria-controls="nova-spaces"><Boxes size={16}/><span>Explore NOVA</span></button>
    {open && <div id="nova-spaces" className="spaces-panel"><div className="spaces-heading"><span>YOUR NOVA SPACES</span><strong>A little more room to think.</strong></div>
      {installed ? <nav aria-label="NOVA spaces"><button onClick={openAssistant}><Sparkles size={17}/><span><strong>Assistant</strong><small>Ask, understand, explore</small></span><ArrowUpRight size={15}/></button><a href="./command.html"><Boxes size={17}/><span><strong>Command Centre</strong><small>Organize tabs and sessions</small></span><ArrowUpRight size={15}/></a><a href="./research.html"><Library size={17}/><span><strong>Research library</strong><small>Keep your ideas together</small></span><ArrowUpRight size={15}/></a></nav> : <p className="spaces-hint">Install NOVA in Chrome to open these spaces. Your dashboard preview stays available here.</p>}
      {message && <p className="spaces-hint" role="status">{message}</p>}
      <p className="spaces-hint">AI is optional and requires a configured backend. Your research stays local unless you choose to share it.</p>
    </div>}
    {!open && message && <p className="spaces-feedback" role="status">{message}</p>}
  </div>
}
