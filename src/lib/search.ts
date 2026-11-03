import type { SearchEngine } from './types'

const searchUrls: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
}

export function searchDestination(input: string, engine: SearchEngine): string | null {
  const query = input.trim()
  if (!query) return null
  // Only navigate directly to explicit HTTP(S) URLs or domain-like inputs.
  // Other schemes and malformed URLs are treated as search terms.
  if (!/\s/.test(query) && (/^https?:\/\//i.test(query) || /^(?:localhost|(?:[\w-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i.test(query))) {
    try {
      const url = new URL(/^https?:\/\//i.test(query) ? query : `https://${query}`)
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username && !url.password) return url.href
    } catch { /* Search for malformed addresses instead. */ }
  }
  return searchUrls[engine] + encodeURIComponent(query)
}
