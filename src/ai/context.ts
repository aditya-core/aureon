export const CONTEXT_LIMIT = 24000
export interface PageContext { title: string; url: string; text: string; kind: 'page' | 'selection'; truncated: boolean; sourceTabId: number; sourceHref: string }
/** Source identity stays in memory only and is never sent to the backend. */
export function isCurrentContext(context: PageContext, tab: chrome.tabs.Tab): boolean {
  if (tab.id !== context.sourceTabId || supportedPage(tab) || !tab.url) return false
  try { const url = new URL(tab.url); url.hash = ''; return url.href === context.sourceHref } catch { return false }
}
export function supportedPage(tab: chrome.tabs.Tab): string | null {
  if (tab.incognito) return 'Private tabs cannot be shared with the AI.'
  try {
    const url = new URL(tab.url || '')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return 'Only normal HTTP(S) pages are supported.'
    const host = url.hostname.toLowerCase(), path = url.pathname.toLowerCase()
    if (/(bank|payment|finance|medical|health|insurance|webmail)/.test(host) || /(^|[.])(mail|gmail|outlook|protonmail|proton|localhost|intranet)([.]|$)/.test(host) || host.endsWith('.gov') || host.endsWith('.gov.in') || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host) || /(^|[\-/])(payment|checkout|login|signin|sign-in|account|accounts|patient|insurance|tax)([\-/]|$)/.test(path)) return 'This page may contain sensitive information and is blocked.'
    return null
  } catch { return 'This page is not supported.' }
}
// Serialized by chrome.scripting: this function must not close over extension variables.
export function extractDocument(kind: 'page' | 'selection', limit: number): { title: string; url: string; sourceHref: string; text: string; truncated: boolean } {
  if (document.querySelector('input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]')) throw new Error('Pages with password fields are blocked.')
  const blocked = 'nav,header,footer,aside,form,input,textarea,select,button,script,style,noscript,iframe,svg,canvas,[hidden],[aria-hidden="true"],[contenteditable],dialog,[role="navigation"],[role="dialog"],[role="complementary"]'
  const visible = (element: Element) => {
    if (element.closest(blocked)) return false
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0' || style.contentVisibility === 'hidden') return false
      if (node.tagName === 'DETAILS' && !node.hasAttribute('open') && element !== node.querySelector('summary') && !node.querySelector('summary')?.contains(element)) return false
    }
    return true
  }
  const safeText = (element: Element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const parts: string[] = []; let count = 0
    while (walker.nextNode()) {
      if (++count > 50000) break
      const node = walker.currentNode
      if (node.parentElement && visible(node.parentElement)) parts.push(node.textContent || '')
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }
  let text = ''
  if (kind === 'selection') {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) throw new Error('Select text on the page first.')
    const range = selection.getRangeAt(0)
    const parent = range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement
    if (!parent || !visible(parent) || [...parent.querySelectorAll(blocked)].some(el => { try { return range.intersectsNode(el) } catch { return false } })) throw new Error('This selection contains protected elements. Select article text only.')
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT); const pieces: string[] = []; let count = 0
    while (walker.nextNode()) {
      if (++count > 50000) throw new Error('Selection is too large to review safely.')
      const node = walker.currentNode
      if (!range.intersectsNode(node)) continue
      if (!node.parentElement || !visible(node.parentElement)) throw new Error('Selection includes hidden content.')
      const value = node.textContent || '', start = node === range.startContainer ? range.startOffset : 0, end = node === range.endContainer ? range.endOffset : value.length
      pieces.push(value.slice(start, end))
    }
    text = pieces.join(' ').replace(/\s+/g, ' ').trim()
  } else {
    const root = document.querySelector('article,main,[role="main"]') || document.body
    if (!root) throw new Error('No readable article found.')
    const blocks = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')].filter(el => visible(el) && !el.parentElement?.closest('li,blockquote,pre'))
    text = blocks.map(safeText).filter(Boolean).join('\n\n')
  }
  if (!text) throw new Error('No readable text found. Try selecting a paragraph.')
  const source = new URL(location.href); source.hash = ''; const sourceHref = source.href; source.search = ''
  return { title: document.title.slice(0,300), url: source.href.slice(0,2048), sourceHref, text: text.slice(0,limit), truncated: text.length > limit }
}
export async function capture(tab: chrome.tabs.Tab, kind: 'page' | 'selection', limit = CONTEXT_LIMIT): Promise<PageContext> {
  const error = supportedPage(tab); if (error) throw new Error(error)
  if (tab.id === undefined) throw new Error('Tab no longer available.')
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractDocument, args: [kind, Math.max(1000, Math.min(CONTEXT_LIMIT, limit))] })
  if (!result) throw new Error('Could not read this page. Click NOVA on the page and try again.')
  // The active tab may have navigated while the script was running.
  const live = await chrome.tabs.get(tab.id)
  if (supportedPage(live) || supportedPage({ ...live, url: result.url }) || !live.url || (() => { const u = new URL(live.url!); u.hash = ''; return u.href !== result.sourceHref })()) throw new Error('The tab changed. Review the page again.')
  return { ...result, kind, sourceTabId: tab.id }
}
