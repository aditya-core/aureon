export type Mode = 'chat' | 'summarise' | 'explain' | 'notes'
export interface Connection { url: string; token: string }
export function backendUrl(input: string): URL {
  const u = new URL(input.trim())
  if (u.username || u.password || u.search || u.hash || !['https:', 'http:'].includes(u.protocol)) throw new Error('Enter a clean HTTPS backend URL.')
  if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('HTTP is allowed only for local development; use HTTPS elsewhere.')
  return u
}
export async function streamAI(connection: Connection, mode: Mode, body: object, signal: AbortSignal, onDelta: (text: string) => void) {
  const base = backendUrl(connection.url); base.pathname = base.pathname.replace(/\/$/, '') + `/api/ai/${mode}/`
  const response = await fetch(base.href, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Token ${connection.token}` }, body:JSON.stringify(body), signal, credentials:'omit', cache:'no-store', redirect:'error' })
  if (!response.ok) { let message = `Server returned ${response.status}.`; try { const data = await response.json(); message = data.error?.message || message } catch { /* no structured error */ } throw new Error(message) }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Server did not return an AI stream.')
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', complete = false, length = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done }); buffer = buffer.replace(/\r\n/g,'\n')
      if (buffer.length > 65536) throw new Error('AI stream exceeded its size limit.')
      let split
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0,split); buffer = buffer.slice(split+2)
        const type = event.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
        const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
        if (type === 'error') { let msg = 'AI stream interrupted.'; try { msg = JSON.parse(data).message || msg } catch { /* malformed event */ } throw new Error(msg) }
        if (type === 'done') complete = true
        if (type === 'delta') { const text: unknown = JSON.parse(data).text; if (typeof text !== 'string' || length + text.length > 12000) throw new Error('Invalid or oversized AI response.'); length += text.length; onDelta(text) }
      }
      if (done || complete) break
    }
    if (!complete) throw new Error('AI stream ended unexpectedly.')
  } finally { reader.releaseLock() }
}
export async function getConnection(): Promise<Connection | null> {
  const data = await chrome.storage.session.get('nova:aiConnection')
  const c = data['nova:aiConnection'] as Connection | undefined
  if (!c?.url || !c.token) return null
  backendUrl(c.url); return c
}
