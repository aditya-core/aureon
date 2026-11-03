const DB_NAME = 'nova-wallpaper'
const STORE = 'images'
const KEY = 'custom'
export const MAX_WALLPAPER_SIZE = 4 * 1024 * 1024
export const WALLPAPER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function validateWallpaper(file: Pick<File, 'size' | 'type'>): string | null {
  if (!WALLPAPER_TYPES.includes(file.type)) return 'Choose a JPEG, PNG, WebP or AVIF image.'
  if (file.size === 0 || file.size > MAX_WALLPAPER_SIZE) return 'Choose an image between 1 byte and 4 MB.'
  return null
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Wallpaper storage unavailable'))
    request.onblocked = () => reject(new Error('Wallpaper storage is blocked by another tab'))
  })
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Wallpaper storage failed')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Wallpaper storage aborted')) }
  })
}
export async function saveWallpaper(file: File): Promise<void> {
  const error = validateWallpaper(file)
  if (error) throw new Error(error)
  await transaction('readwrite', store => store.put(file, KEY))
}
export async function getWallpaper(): Promise<Blob | null> {
  const result: unknown = await transaction('readonly', store => store.get(KEY))
  return result instanceof Blob ? result : null
}
export async function deleteWallpaper(): Promise<void> { await transaction('readwrite', store => store.delete(KEY)) }
