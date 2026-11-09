const DB_NAME = 'chronos-audio'
const DB_VERSION = 1
const STORE_NAME = 'sounds'

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open audio storage'))
  })
}

async function transact(mode, operation) {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode)
      const store = tx.objectStore(STORE_NAME)
      let request
      try {
        request = operation(store)
      } catch (error) {
        reject(error)
        return
      }

      let value
      request.onsuccess = () => {
        value = request.result
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve(value)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Persists an uploaded audio file and returns its metadata. */
export async function saveCustomSound(file) {
  const id = `snd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const fallbackName = 'Custom sound'
  const name =
    (file.name || fallbackName)
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 48) || fallbackName

  const record = {
    id,
    name,
    type: file.type || 'audio/mpeg',
    blob: file,
    createdAt: Date.now(),
  }

  await transact('readwrite', (store) => store.put(record))
  return { id, name, type: record.type }
}

/** Lists uploaded sounds without exposing their blobs. */
export async function listCustomSounds() {
  const records = await transact('readonly', (store) => store.getAll())
  if (!Array.isArray(records)) return []
  return records
    .map((record) => ({ id: record.id, name: record.name, type: record.type }))
    .filter((record) => typeof record.id === 'string' && record.id)
}

/** Returns a full record including the audio blob. */
export async function getCustomSound(id) {
  if (!id) return null
  const record = await transact('readonly', (store) => store.get(id))
  return record ?? null
}

export async function deleteCustomSound(id) {
  if (!id) return
  await transact('readwrite', (store) => store.delete(id))
}
