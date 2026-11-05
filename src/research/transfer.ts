import { duplicateKey, safeUrl } from '../command/model'
import type { Collection, KnowledgeCard, SavedPage } from './db'

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
export interface ResearchBackup { format: 'nova-research'; version: 1; exportedAt: number; collections: Collection[]; pages: SavedPage[] }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown, max: number, required = false): value is string => typeof value === 'string' && value.length <= max && (!required || !!value.trim())
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const strings = (value: unknown, maxItems: number, maxLength: number, allowEmpty = false): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every(item => string(item, maxLength, !allowEmpty))
function validateCard(value: unknown): KnowledgeCard | undefined {
  if (value === undefined) return undefined
  if (!record(value) || !string(value.summary, 4000, true) || !strings(value.takeaways, 12, 500, true) || !strings(value.tags, 12, 40, true) || !timestamp(value.generatedAt)) throw new Error('A knowledge card is invalid. Nothing was imported.')
  return { summary: value.summary, takeaways: value.takeaways, tags: value.tags, generatedAt: value.generatedAt }
}
/** Strict allowlist: invalid files are rejected before opening a write transaction. */
export function parseResearchBackup(text: string): ResearchBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup is larger than 5 MB. Nothing was imported.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('This is not a valid JSON backup. Nothing was imported.') }
  if (!record(value) || value.format !== 'nova-research' || value.version !== 1 || !timestamp(value.exportedAt) || !Array.isArray(value.collections) || !Array.isArray(value.pages)) throw new Error('This is not a supported NOVA Research backup. Nothing was imported.')
  if (value.collections.length > 1000 || value.pages.length > 5000) throw new Error('Backup exceeds the limit of 1,000 collections or 5,000 pages. Nothing was imported.')
  const collectionIds = new Set<string>(), pageIds = new Set<string>()
  const collections = value.collections.map((item: unknown): Collection => {
    if (!record(item) || !string(item.id, 80, true) || collectionIds.has(item.id) || !string(item.name, 80, true) || !string(item.description, 1000) || !timestamp(item.createdAt)) throw new Error('A collection is invalid. Nothing was imported.')
    collectionIds.add(item.id); return { id: item.id, name: item.name, description: item.description, createdAt: item.createdAt }
  })
  const pages = value.pages.map((item: unknown): SavedPage => {
    if (!record(item) || !string(item.id, 80, true) || pageIds.has(item.id) || !string(item.url, 4096, true) || !safeUrl(item.url) || !string(item.title, 300, true) || !string(item.description, 2000) || !strings(item.tags, 20, 40) || !string(item.notes, 20000) || !(item.collectionId === null || string(item.collectionId, 80, true)) || !strings(item.relatedIds, 50, 80) || !timestamp(item.createdAt) || !timestamp(item.updatedAt)) throw new Error('A saved page is invalid. Nothing was imported.')
    pageIds.add(item.id)
    const card = validateCard(item.card)
    return { id: item.id, url: safeUrl(item.url)!, urlKey: duplicateKey(item.url)!, title: item.title, description: item.description, tags: item.tags, notes: item.notes, collectionId: item.collectionId, relatedIds: item.relatedIds, ...(card ? { card } : {}), createdAt: item.createdAt, updatedAt: item.updatedAt }
  })
  return { format: 'nova-research', version: 1, exportedAt: value.exportedAt, collections, pages }
}
export function createResearchBackup(collections: Collection[], pages: SavedPage[]): string {
  const text = JSON.stringify({ format: 'nova-research', version: 1, exportedAt: Date.now(), collections, pages }, null, 2)
  // Verify exports are always importable before offering them for download.
  const sanitized = parseResearchBackup(text)
  return JSON.stringify(sanitized, null, 2)
}
