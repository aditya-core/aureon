import { exactKey } from './model'

/** Recheck every tab immediately before closing. Failures and stale candidates are reported. */
export async function closeExactDuplicates(keepId: number, candidates: chrome.tabs.Tab[]): Promise<{ closed: number; skipped: number; failed: number; stopped: boolean }> {
  const original = candidates.find(tab => tab.id === keepId), expected = exactKey(original?.url)
  if (!expected || !original || original.incognito) throw new Error('The tab to keep is unavailable or unsupported.')
  const keep = await chrome.tabs.get(keepId)
  if (keep.incognito || exactKey(keep.url) !== expected) throw new Error('The tab to keep changed. Review the duplicate group again.')
  let closed=0, skipped=0, failed=0, stopped=false
  for (const candidate of candidates) {
    if (candidate.id === undefined || candidate.id === keepId) continue
    let currentKeep: chrome.tabs.Tab
    try { currentKeep = await chrome.tabs.get(keepId) } catch { stopped=true; break }
    if (currentKeep.incognito || exactKey(currentKeep.url) !== expected) { stopped=true; break }
    try {
      const live = await chrome.tabs.get(candidate.id)
      if (live.incognito || exactKey(candidate.url) !== expected || exactKey(live.url) !== expected) { skipped++; continue }
      await chrome.tabs.remove(candidate.id); closed++
    } catch { failed++ }
  }
  return { closed, skipped, failed, stopped }
}
export async function applyTabs(tabs: chrome.tabs.Tab[], action: (tab: chrome.tabs.Tab) => Promise<void>): Promise<{ completed: number; failures: string[] }> {
  let completed = 0; const failures: string[] = []
  for (const tab of tabs) {
    if (tab.id === undefined || tab.incognito) { failures.push(`${tab.title || 'Tab'}: unavailable or private.`); continue }
    try { const live = await chrome.tabs.get(tab.id); if (live.incognito) throw new Error('Private tabs are excluded.'); await action(live); completed++ }
    catch (error) { failures.push(`${tab.title || `Tab ${tab.id}`}: ${error instanceof Error ? error.message : 'browser operation failed'}`) }
  }
  return { completed, failures }
}
