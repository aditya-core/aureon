(() => {
  if (globalThis.NovaWebPicker) { globalThis.NovaWebPicker.start(); return }
  const M = globalThis.NovaWebModel
  let overlay = null, current = null
  const blocked = 'a,button,input,textarea,select,form,video,audio,iframe,[contenteditable="true"]'
  function cleanup() { document.removeEventListener('mousemove', move, true); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key, true); overlay?.remove(); overlay = null; current = null }
  function move(event) {
    const element = event.target
    if (!(element instanceof Element) || element === overlay || element === document.body || element === document.documentElement || element.matches('main,header,footer,nav') || element.closest(blocked)) { current = null; if (overlay) overlay.style.display = 'none'; return }
    current = element; const r = element.getBoundingClientRect(); Object.assign(overlay.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
  }
  function selector(element) {
    const parts = []
    for (let el = element; el && el !== document.body && parts.length < 8; el = el.parentElement) {
      const tag = el.tagName.toLowerCase()
      if (!/^[a-z][a-z0-9-]*$/.test(tag)) return null
      if (/^[a-z][a-z0-9_-]{0,63}$/i.test(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) { parts.unshift(`${tag}#${el.id}`); break }
      let index = 1, sibling = el.previousElementSibling
      while (sibling) { if (sibling.tagName === el.tagName) index++; sibling = sibling.previousElementSibling }
      parts.unshift(`${tag}:nth-of-type(${index})`)
    }
    const result = parts.join(' > ')
    return M.validSelector(result) && document.querySelectorAll(result).length === 1 ? result : null
  }
  function notice(text) { const n = document.createElement('div'); n.textContent = text; n.setAttribute('role','status'); Object.assign(n.style,{position:'fixed',top:'12px',left:'50%',transform:'translateX(-50%)',zIndex:'2147483647',padding:'12px',background:'#202331',color:'#fff',font:'14px system-ui',borderRadius:'8px',pointerEvents:'none'}); document.documentElement.append(n); setTimeout(() => n.remove(), 4500) }
  function click(event) {
    event.preventDefault(); event.stopImmediatePropagation()
    const target = current, selected = target ? selector(target) : null
    cleanup()
    if (!selected) { notice('NOVA: choose a non-essential element with a unique selector.'); return }
    if (target.querySelector('input,textarea,select,button,form,[role="button"],[role="navigation"],[role="main"],[contenteditable="true"]') && !window.confirm('This area contains interactive controls. Hide it anyway? You can undo it from NOVA.')) { notice('NOVA: selection cancelled.'); return }
    chrome.runtime.sendMessage({ type: 'NOVA_WEB_ADD_RULE', selector: selected }).then(result => notice(result?.ok ? 'NOVA: element hidden. Manage or undo in the popup.' : `NOVA: ${result?.error || 'Could not hide this element.'}`)).catch(() => notice('NOVA: could not save the hiding rule.'))
  }
  function key(event) { if (event.key === 'Escape') { event.preventDefault(); cleanup(); notice('NOVA: selection cancelled.') } }
  function start() {
    cleanup(); overlay = document.createElement('div'); Object.assign(overlay.style,{position:'fixed',pointerEvents:'none',display:'none',border:'2px solid #9f86ff',background:'rgba(159,134,255,.18)',zIndex:'2147483646'}); document.documentElement.append(overlay)
    document.addEventListener('mousemove', move, true); document.addEventListener('click', click, true); document.addEventListener('keydown', key, true); notice('NOVA: hover and click an element to hide it. Press Escape to cancel.')
  }
  globalThis.NovaWebPicker = { start, cleanup }; start()
})()
