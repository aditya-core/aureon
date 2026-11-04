// Event-driven MV3 worker. No polling or persistent timers.
const selectorSegment = '[a-z][a-z0-9-]*(?:#[a-z][a-z0-9_-]{0,63})?(?::nth-of-type\\([1-9][0-9]{0,3}\\))?'
const selectorPattern = new RegExp(`^${selectorSegment}(?: > ${selectorSegment}){0,7}$`, 'i')
function safeSelector(value) {
  if (typeof value !== 'string' || value.length > 250 || !selectorPattern.test(value)) return false
  const tag = value.split(' > ').at(-1).split(/[#:\s]/)[0].toLowerCase()
  return !['html','body','head','main','header','footer','nav','form','input','textarea','select','button','a','video','audio','iframe','script','style'].includes(tag)
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (typeof sender.tab?.id !== 'number' || sender.frameId !== 0 || !sender.tab.url || !sender.url) return false
  let pageOrigin
  try { const page = new URL(sender.url); const tab = new URL(sender.tab.url); if (!['http:', 'https:'].includes(page.protocol) || page.origin !== tab.origin) return false; pageOrigin = page.origin } catch { return false }
  const tabId = sender.tab.id
  // Document-scoped injection prevents a delayed response from styling a newly navigated page.
  const target = sender.documentId ? { tabId, documentIds: [sender.documentId] } : { tabId, frameIds: [0] }
  if (message?.type === 'NOVA_WEB_CSS') {
    if (typeof message.previous !== 'string' || typeof message.css !== 'string' || message.previous.length > 20000 || message.css.length > 20000) { respond({ ok: false, error: 'Invalid style.' }); return false }
    ;(async () => {
      if (message.previous) await chrome.scripting.removeCSS({ target, css: message.previous, origin: 'USER' })
      if (message.css) await chrome.scripting.insertCSS({ target, css: message.css, origin: 'USER' })
      return { ok: true }
    })().then(respond).catch(error => respond({ ok: false, error: error.message }))
    return true
  }
  if (message?.type === 'NOVA_WEB_READER_CSS') {
    const options = { target, files: ['web/reader.css'], origin: 'USER' }
    const task = message.enable === true ? chrome.scripting.insertCSS(options) : chrome.scripting.removeCSS(options)
    task.then(() => respond({ ok: true })).catch(error => respond({ ok: false, error: error.message }))
    return true
  }
  if (message?.type === 'NOVA_WEB_ADD_RULE') {
    if (!safeSelector(message.selector)) { respond({ ok: false, error: 'This element cannot be safely hidden.' }); return false }
    ;(async () => {
      const key = `nova:web:${pageOrigin}`
      const stored = await chrome.storage.local.get(key)
      const profile = stored[key]
      if (!profile || typeof profile !== 'object' || profile.enabled !== true) throw new Error('Enable NOVA for this site first.')
      const rules = Array.isArray(profile.rules) ? profile.rules.filter(r => r && safeSelector(r.selector)).slice(0, 50) : []
      if (rules.length >= 50) throw new Error('This site already has 50 rules.')
      if (!rules.some(r => r.selector === message.selector)) rules.push({ id: crypto.randomUUID(), selector: message.selector, enabled: true })
      const next = { ...profile, rules }
      await chrome.storage.local.set({ [key]: next })
      const result = await chrome.tabs.sendMessage(tabId, { type: 'NOVA_WEB_SET', profile: next }, sender.documentId ? { documentId: sender.documentId } : { frameId: 0 })
      if (result?.error) throw new Error(result.error)
      return { ok: true }
    })().then(respond).catch(error => respond({ ok: false, error: error.message }))
    return true
  }
  return false
})
