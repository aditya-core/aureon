(() => {
  const M = globalThis.NovaWebModel
  if (!M || globalThis.NovaWebAppearance) return
  let applied = '', active = false, chain = Promise.resolve(), explicitVersion = 0
  async function set(profile) {
    const css = M.buildCSS(profile, location.hostname)
    chain = chain.catch(() => {}).then(async () => {
      if (css === applied) { active = !!css; return }
      const response = await chrome.runtime.sendMessage({ type: 'NOVA_WEB_CSS', previous: applied, css })
      if (!response?.ok) throw new Error(response?.error || 'Could not update page styling.')
      applied = css; active = !!css
    })
    await chain
    return { active }
  }
  globalThis.NovaWebAppearance = { set }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'NOVA_WEB_SET') { explicitVersion++; set(message.profile).then(respond).catch(error => respond({ error: error.message })); return true }
    if (message?.type === 'NOVA_WEB_STATUS') { respond({ active }); return false }
  })
  // Auto-run is effective only in an explicitly registered, granted origin.
  const origin = M.originOf(location.href)
  const version = explicitVersion
  if (origin) chrome.storage.local.get(M.key(origin)).then(result => {
    if (version !== explicitVersion) return
    const profile = M.normalize(result[M.key(origin)])
    if (profile.auto && profile.enabled) return set(profile)
  }).catch(() => {})
})()
