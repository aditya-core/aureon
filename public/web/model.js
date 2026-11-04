(() => {
  if (globalThis.NovaWebModel) return
  const fonts = { system: 'system-ui, sans-serif', serif: 'Georgia, serif', sans: 'Arial, sans-serif', mono: 'ui-monospace, monospace' }
  const defaults = () => ({ enabled: false, auto: false, distractions: true, dark: { enabled: false, background: '#12151d', surface: '#1c222e', text: '#e8eaf1', link: '#a8c5ff' }, typography: { enabled: false, font: 'system', size: 17, lineHeight: 1.6, letterSpacing: 0, width: 900 }, reader: { font: 'serif', size: 20, lineHeight: 1.7, width: 720, theme: 'warm' }, rules: [] })
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  const number = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
  const color = (v, fallback) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
  const font = v => Object.hasOwn(fonts, v) ? v : 'system'
  const segment = '[a-z][a-z0-9-]*(?:#[a-z][a-z0-9_-]{0,63})?(?::nth-of-type\\([1-9][0-9]{0,3}\\))?'
  const selectorPattern = new RegExp(`^${segment}(?: > ${segment}){0,7}$`, 'i')
  function validSelector(v) {
    if (typeof v !== 'string' || v.length > 250 || !selectorPattern.test(v)) return false
    const last = v.split(' > ').at(-1).split(/[#:\s]/)[0].toLowerCase()
    return !['html','body','head','main','header','footer','nav','form','input','textarea','select','button','a','video','audio','iframe','script','style'].includes(last)
  }
  function normalize(input) {
    const d = defaults(), v = obj(input), dark = obj(v.dark), type = obj(v.typography), reader = obj(v.reader)
    return {
      enabled: v.enabled === true, auto: v.auto === true, distractions: v.distractions !== false,
      dark: { enabled: dark.enabled === true, background: color(dark.background, d.dark.background), surface: color(dark.surface, d.dark.surface), text: color(dark.text, d.dark.text), link: color(dark.link, d.dark.link) },
      typography: { enabled: type.enabled === true, font: font(type.font), size: number(type.size, d.typography.size, 12, 30), lineHeight: number(type.lineHeight, d.typography.lineHeight, 1, 2.5), letterSpacing: number(type.letterSpacing, 0, -1, 3), width: number(type.width, d.typography.width, 450, 1600) },
      reader: { font: font(reader.font) === 'system' && reader.font !== 'system' ? 'serif' : font(reader.font), size: number(reader.size, d.reader.size, 14, 36), lineHeight: number(reader.lineHeight, d.reader.lineHeight, 1.2, 2.5), width: number(reader.width, d.reader.width, 450, 1100), theme: ['light','dark','warm'].includes(reader.theme) ? reader.theme : 'warm' },
      rules: (Array.isArray(v.rules) ? v.rules : []).filter(r => r && typeof r.id === 'string' && r.id.length <= 80 && validSelector(r.selector)).slice(0, 50).map(r => ({ id: r.id, selector: r.selector, enabled: r.enabled !== false }))
    }
  }
  function originOf(url) { try { const u = new URL(url); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname ? u.origin : null } catch { return null } }
  function key(origin) { return `nova:web:${origin}` }
  function buildCSS(profile, hostname = '') {
    const p = normalize(profile)
    if (!p.enabled) return ''
    let css = ''
    if (p.dark.enabled) {
      const d = p.dark
      css += `html,body{background-color:${d.background} !important;color:${d.text} !important;color-scheme:dark} main,article,aside,section,header,footer,nav{background-color:${d.surface} !important;color:${d.text} !important} p,h1,h2,h3,h4,h5,h6,li,blockquote,dt,dd{color:${d.text} !important} a:any-link{color:${d.link} !important}`
      if (hostname === 'en.wikipedia.org' || hostname.endsWith('.wikipedia.org')) css += ` .mw-page-container,.mw-body,.mw-content-container{background-color:${d.surface} !important;color:${d.text} !important}`
      if (hostname === 'github.com') css += ` .application-main,.Layout-main{background-color:${d.background} !important;color:${d.text} !important}`
    }
    if (p.typography.enabled) {
      const t = p.typography
      css += ` p,h1,h2,h3,h4,h5,h6,li,blockquote,dt,dd{font-family:${fonts[t.font]} !important;font-size:${t.size}px !important;line-height:${t.lineHeight} !important;letter-spacing:${t.letterSpacing}px !important} article,[role="article"]{max-width:${t.width}px !important;margin-left:auto !important;margin-right:auto !important}`
    }
    for (const r of p.rules) if (p.distractions && r.enabled) css += ` ${r.selector}{display:none !important}`
    return css.trim()
  }
  globalThis.NovaWebModel = Object.freeze({ defaults, normalize, originOf, key, validSelector, buildCSS, fonts })
})()
