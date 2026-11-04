(() => {
  if (globalThis.NovaWebReader) return
  const M = globalThis.NovaWebModel
  let root = null, previousFocus = null
  const allowed = new Set(['P','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','CODE','EM','STRONG','B','I','BR','A','DIV','SECTION','ARTICLE','SPAN'])
  const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','FORM','BUTTON','INPUT','SELECT','TEXTAREA','NAV','ASIDE','HEADER','FOOTER','IMG','VIDEO','AUDIO','SVG','CANVAS'])
  function extract() {
    const source = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]')
    if (!source || (source.textContent || '').trim().length < 200) return null
    const title = (source.querySelector('h1')?.textContent || document.querySelector('h1')?.textContent || document.title || 'Article').trim().slice(0, 250)
    const target = document.createDocumentFragment()
    let visited = 0, chars = 0
    function copy(node, parent) {
      if (++visited > 3000 || chars > 300000) return
      if (node.nodeType === Node.TEXT_NODE) { const text = (node.nodeValue || '').slice(0, 300000 - chars); chars += text.length; parent.append(document.createTextNode(text)); return }
      if (node.nodeType !== Node.ELEMENT_NODE || skip.has(node.tagName)) return
      const el = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment()
      if (node.tagName === 'A') {
        try { const url = new URL(node.getAttribute('href') || '', document.baseURI); if (['http:', 'https:'].includes(url.protocol)) { el.href = url.href; el.rel = 'noopener noreferrer'; el.target = '_blank' } } catch { /* link remains text */ }
      }
      for (const child of node.childNodes) copy(child, el)
      parent.append(el)
    }
    for (const child of source.childNodes) copy(child, target)
    if (chars < 200) return null
    return { title, content: target }
  }
  async function close() {
    if (!root) return
    root.remove(); root = null
    try { await chrome.runtime.sendMessage({ type: 'NOVA_WEB_READER_CSS', enable: false }) } catch { /* page may be closing */ }
    previousFocus?.focus?.(); previousFocus = null
  }
  async function open(options) {
    if (root) { await close(); return { open: false } }
    if (document.getElementById('nova-web-reader-root')) return { error: 'This page already uses NOVA’s reader container ID.' }
    const article = extract()
    if (!article) return { error: 'No supported article found on this page.' }
    const response = await chrome.runtime.sendMessage({ type: 'NOVA_WEB_READER_CSS', enable: true })
    if (!response?.ok) return { error: response?.error || 'Reader style could not be loaded.' }
    const prefs = M.normalize({ reader: options }).reader
    previousFocus = document.activeElement
    root = document.createElement('div'); root.id = 'nova-web-reader-root'; root.tabIndex = -1; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'NOVA Reader')
    const toolbar = document.createElement('div'); toolbar.className = 'nova-reader-toolbar'
    const heading = document.createElement('strong'); heading.textContent = 'NOVA Reader'; toolbar.append(heading)
    const feedback = document.createElement('span'); feedback.setAttribute('role', 'status'); feedback.style.fontSize = '12px'; toolbar.append(feedback)
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Exit reader'; button.addEventListener('click', () => { void close() }); toolbar.append(button)
    const content = document.createElement('main'); content.className = 'nova-reader-content'
    const title = document.createElement('h1'); title.textContent = article.title; content.append(title, article.content)
    function apply() {
      const colors = { warm: ['#f7f1e4','#30291f','#71532d'], light: ['#ffffff','#20242a','#254c8b'], dark: ['#171b24','#e8eaf1','#a8c5ff'] }[prefs.theme]
      root.style.setProperty('--nr-bg', colors[0]); root.style.setProperty('--nr-ink', colors[1]); root.style.setProperty('--nr-link', colors[2]); root.style.setProperty('--nr-font', M.fonts[prefs.font]); root.style.setProperty('--nr-width', `${prefs.width}px`); root.style.setProperty('--nr-size', `${prefs.size}px`); root.style.setProperty('--nr-line', String(prefs.lineHeight))
    }
    function select(labelText, field, values) {
      const label = document.createElement('label'); label.append(document.createTextNode(labelText + ' ')); const el = document.createElement('select'); el.setAttribute('aria-label', labelText)
      for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; el.append(option) }
      el.value = prefs[field]; el.addEventListener('change', () => { prefs[field] = el.value; apply(); save() }); label.append(el); toolbar.append(label)
    }
    function range(labelText, field, min, max, step) {
      const label = document.createElement('label'); label.append(document.createTextNode(labelText + ' ')); const el = document.createElement('input'); el.type = 'number'; el.min = String(min); el.max = String(max); el.step = String(step); el.value = String(prefs[field]); el.setAttribute('aria-label', labelText)
      el.addEventListener('change', () => { const v = Number(el.value); if (Number.isFinite(v)) { prefs[field] = Math.max(min, Math.min(max, v)); el.value = String(prefs[field]); apply(); save() } }); label.append(el); toolbar.append(label)
    }
    async function save() {
      try { const key = M.key(location.origin); const stored = await chrome.storage.local.get(key); await chrome.storage.local.set({ [key]: { ...M.normalize(stored[key]), reader: { ...prefs } } }) } catch { feedback.textContent = 'Could not save reader preferences; changes apply only for this session.' }
    }
    select('Theme','theme',['warm','light','dark']); select('Font','font',['serif','system','sans','mono']); range('Size','size',14,36,1); range('Line height','lineHeight',1.2,2.5,.1); range('Width','width',450,1100,50)
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); void close(); return }
      if (event.key !== 'Tab') return
      const nodes = [...root.querySelectorAll('button,select,input,a[href]')]
      if (!nodes.length) { event.preventDefault(); return }
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    })
    root.append(toolbar, content); document.documentElement.append(root); apply(); root.focus()
    return { open: true }
  }
  globalThis.NovaWebReader = { open, close }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => { if (message?.type !== 'NOVA_WEB_READER') return false; open(message.options).then(respond).catch(error => respond({ error: error.message })); return true })
})()
