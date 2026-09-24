import { openDB, type DBSchema } from 'idb'
import type { MediaRecord, VaultData } from '../types'

interface StoredMedia {
  record: MediaRecord
  blob: Blob
}

interface XinluDB extends DBSchema {
  vault: {
    key: 'current'
    value: VaultData
  }
  media: {
    key: string
    value: StoredMedia
  }
}

const dbPromise = openDB<XinluDB>('xinlu-local', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('vault')) {
      db.createObjectStore('vault')
    }
    if (!db.objectStoreNames.contains('media')) {
      db.createObjectStore('media', { keyPath: 'record.id' })
    }
  },
})

export async function loadVault(): Promise<VaultData | undefined> {
  const db = await dbPromise
  return db.get('vault', 'current')
}

export async function saveVault(vault: VaultData): Promise<void> {
  const db = await dbPromise
  await db.put('vault', vault, 'current')
}

export async function putStoredMedia(record: MediaRecord, blob: Blob): Promise<void> {
  const db = await dbPromise
  await db.put('media', { record, blob })
}

export async function getStoredMedia(id: string): Promise<StoredMedia | undefined> {
  const db = await dbPromise
  return db.get('media', id)
}

export async function getAllStoredMedia(): Promise<StoredMedia[]> {
  const db = await dbPromise
  return db.getAll('media')
}

export async function deleteStoredMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await dbPromise
  const tx = db.transaction('media', 'readwrite')
  await Promise.all(ids.map((id) => tx.store.delete(id)))
  await tx.done
}

export async function replaceLocalData(vault: VaultData, media: StoredMedia[]): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(['vault', 'media'], 'readwrite')
  await tx.objectStore('vault').put(vault, 'current')
  await tx.objectStore('media').clear()
  await Promise.all(media.map((item) => tx.objectStore('media').put(item)))
  await tx.done
}

export async function clearLocalData(): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(['vault', 'media'], 'readwrite')
  await tx.objectStore('vault').clear()
  await tx.objectStore('media').clear()
  await tx.done
}

export type { StoredMedia }
