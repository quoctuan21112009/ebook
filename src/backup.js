import JSZip from 'jszip'
import { getFile, putFile, ensureFile, ensureReflow } from './storage'

export async function exportBackup(user, books, progress, annotations, prefs) {
  const zip = new JSZip()
  const coverTypes = {}
  for (const book of books) {
    const data = await ensureFile(book.id, book.sha256)
    if (data) zip.file(`files/${book.id}`, data)
    const cover = await getFile(`${book.id}:cover`)
    if (cover) { zip.file(`covers/${book.id}`, cover); coverTypes[book.id] = cover.type }
    if (book.hasReflow) { const reflow = await ensureReflow(book.id); zip.file(`reflow/${book.id}`, reflow) }
  }
  zip.file('library.json', JSON.stringify({ version: 1, user, books, progress, annotations, prefs, coverTypes, exported: new Date().toISOString() }))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export async function importBackup(file) {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('library.json')
  if (!manifestFile) throw new Error('Tệp sao lưu không hợp lệ.')
  const manifest = JSON.parse(await manifestFile.async('text'))
  if (manifest.version !== 1 || !Array.isArray(manifest.books)) throw new Error('Phiên bản sao lưu chưa được hỗ trợ.')
  const books = []; const progress = {}; const annotations = {}
  for (const item of manifest.books) {
    if (!item || !/^[0-9a-f-]{36}$/i.test(item.id) || !['epub','pdf'].includes(item.type)) continue
    const content = zip.file(`files/${item.id}`)
    if (!content) continue
    const id = crypto.randomUUID()
    await putFile(id, await content.async('arraybuffer'))
    const cover = zip.file(`covers/${item.id}`)
    if (cover) await putFile(`${id}:cover`, new Blob([await cover.async('uint8array')], { type: manifest.coverTypes?.[item.id] || 'image/jpeg' }))
    const reflow = zip.file(`reflow/${item.id}`)
    if (reflow) await putFile(`${id}:reflow`, await reflow.async('arraybuffer'))
    books.push({ ...item, id })
    if (manifest.progress?.[item.id]) progress[id] = manifest.progress[item.id]
    if (manifest.annotations?.[item.id]) annotations[id] = manifest.annotations[item.id]
  }
  return { books, progress, annotations, prefs: manifest.prefs }
}
