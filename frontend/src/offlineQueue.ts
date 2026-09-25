/**
 * Offline queue using IndexedDB via a simple wrapper.
 * Pending records show PENDING SYNC until the server accepts them.
 * Retries use idempotency_key to prevent duplicates.
 */

const DB_NAME = 'catchshield-offline'
const STORE = 'pending-batches'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'idempotency_key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface PendingBatch {
  idempotency_key: string
  fisher_internal_id: string
  species: string
  weight_kg: number
  catch_zone: string
  catch_time: string
  landing_centre: string
  queued_at: string
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED'
  batch_id?: string
  error?: string
}

export async function queueBatch(data: Omit<PendingBatch, 'queued_at' | 'status'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...data, queued_at: new Date().toISOString(), status: 'PENDING_SYNC' })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingBatches(): Promise<PendingBatch[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as PendingBatch[])
    req.onerror = () => reject(req.error)
  })
}

export async function updateBatchStatus(
  idempotency_key: string,
  update: Partial<PendingBatch>
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(idempotency_key)
    getReq.onsuccess = () => {
      const record = getReq.result
      if (record) store.put({ ...record, ...update })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearSynced(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.openCursor()
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        if (cursor.value.status === 'SYNCED') cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
