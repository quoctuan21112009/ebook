const DB = 'thu-cac-books'
const STORE = 'files'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function putFile(id, buffer) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(buffer, id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getFile(id) {
  const db = await openDb()
  const result = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return result
}

export async function ensureFile(id, sha256) {
  const local = await getFile(id)
  if (local && (!sha256 || localStorage.getItem(`tc-file-hash:${id}`) === sha256)) return local
  const response = await fetch(`/api/books/${encodeURIComponent(id)}/file`)
  if (!response.ok) throw new Error('Không tải được sách từ máy chủ.')
  const buffer = await response.arrayBuffer()
  await putFile(id, buffer)
  if (sha256) localStorage.setItem(`tc-file-hash:${id}`, sha256)
  return buffer
}

export async function ensureReflow(id) {
  const key = `${id}:reflow`
  const local = await getFile(key)
  if (local) return local
  const response = await fetch(`/api/books/${encodeURIComponent(id)}/epub`)
  if (!response.ok) throw new Error('Không tải được bản EPUB chuyển đổi.')
  const buffer = await response.arrayBuffer()
  await putFile(key, buffer)
  return buffer
}

export async function deleteFile(id) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
