import { ArrowUpRight, Search as SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { searchDestination } from '../lib/search'
import type { SearchEngine } from '../lib/types'

export function Search({ engine }: { engine: SearchEngine }) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); input.current?.focus()
      } else if (event.key === '/' && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLElement && target.isContentEditable)) {
        event.preventDefault(); input.current?.focus()
      }
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])
  return <form className="search" role="search" onSubmit={event => {
    event.preventDefault()
    const destination = searchDestination(query, engine)
    if (destination) window.location.assign(destination)
  }}>
    <SearchIcon className="search-icon" size={19} aria-hidden="true" />
    <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the web or enter a URL" aria-label="Search the web or enter a URL" autoComplete="off" />
    <span className="search-shortcut" aria-hidden="true">/</span>
    <button type="submit" className="search-submit" aria-label="Search"><ArrowUpRight size={18} /></button>
  </form>
}
