import JSZip from 'jszip'

function normalizedPath(base, relative) {
  const parts = [...base.split('/').slice(0, -1), ...decodeURIComponent(relative).split('/')]
  const result = []
  for (const part of parts) {
    if (part === '..') result.pop()
    else if (part && part !== '.') result.push(part)
  }
  return result.join('/')
}

export async function extractEpubCover(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const container = zip.file('META-INF/container.xml')
  if (!container) return null
  const containerDoc = new DOMParser().parseFromString(await container.async('text'), 'application/xml')
  const opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath || !zip.file(opfPath)) return null
  const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('text'), 'application/xml')
  const items = [...opf.getElementsByTagName('item')]
  const coverId = [...opf.getElementsByTagName('meta')].find(el => el.getAttribute('name') === 'cover')?.getAttribute('content')
  const item = items.find(el => (el.getAttribute('properties') || '').split(/\s+/).includes('cover-image'))
    || items.find(el => el.getAttribute('id') === coverId)
    || items.find(el => /cover/i.test(el.getAttribute('id') || '') && /^image\//.test(el.getAttribute('media-type') || ''))
  if (!item) return null
  const path = normalizedPath(opfPath, item.getAttribute('href') || '')
  if (!zip.file(path)) return null
  const bytes = await zip.file(path).async('uint8array')
  const blob = new Blob([bytes], { type: item.getAttribute('media-type') || 'image/jpeg' })
  if (blob.type !== 'image/svg+xml') return blob
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(image.naturalWidth || 300, 1000)
    canvas.height = Math.min(image.naturalHeight || 400, 1400)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

export async function suggestQuoteFromEpub(buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const chapter = Object.keys(zip.files).find(name => /\.(xhtml|html)$/i.test(name) && !/nav|toc/i.test(name))
  if (!chapter) return ''
  const doc = new DOMParser().parseFromString(await zip.file(chapter).async('text'), 'text/html')
  const text = [...doc.querySelectorAll('p')].map(p => p.textContent?.replace(/\s+/g,' ').trim()).find(t => t?.length > 35)
  return text ? text.slice(0, 260) : ''
}

export async function loadPdf(buffer) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)), useSystemFonts: true }).promise
}

export async function pdfCover(buffer) {
  const pdf = await loadPdf(buffer)
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: Math.min(1, 270 / page.getViewport({ scale: 1 }).width) })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  } finally { pdf.destroy() }
}

export function extractPdfParagraphs(items) {
  const lines = []
  let line = null
  let previous = null
  const finishLine = () => {
    if (line?.text.trim()) lines.push({ ...line, text: line.text.normalize('NFC').replace(/\s+/g, ' ').trim() })
    line = null; previous = null
  }
  for (const item of items) {
    const str = String(item.str || '').normalize('NFC')
    if (!str) { if (item.hasEOL) finishLine(); continue }
    const x = Number(item.transform?.[4]) || 0
    const y = Number(item.transform?.[5]) || 0
    const fontSize = Math.max(6, Number(item.height) || 0, Math.hypot(Number(item.transform?.[0]) || 0, Number(item.transform?.[1]) || 0))
    if (!line || Math.abs(y - line.y) > Math.max(2, fontSize * .35) || (previous && x < previous.x - fontSize)) finishLine()
    if (!line) line = { text: '', x, y, fontSize }
    if (previous) {
      const gap = x - previous.endX
      if (gap > Math.max(1.3, fontSize * .23) && !/\s$/.test(line.text) && !/^\s/.test(str)) line.text += ' '
    }
    line.text += str
    previous = { x, endX: x + (Number(item.width) || str.length * fontSize * .5) }
    if (item.hasEOL) finishLine()
  }
  finishLine()
  const paragraphs = []
  let paragraph = ''
  let last = null
  for (const current of lines) {
    const newParagraph = last && (Math.abs(current.y - last.y) > Math.max(current.fontSize, last.fontSize) * 1.5 || current.x - last.x > current.fontSize * 1.2)
    if (newParagraph && paragraph) { paragraphs.push(paragraph); paragraph = '' }
    paragraph += (paragraph ? ' ' : '') + current.text
    last = current
  }
  if (paragraph) paragraphs.push(paragraph)
  return paragraphs
}

export async function suggestQuoteFromPdf(buffer) {
  const pdf = await loadPdf(buffer)
  try {
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    return extractPdfParagraphs(content.items).join(' ').slice(0,260)
  } finally { pdf.destroy() }
}

function esc(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }

export async function pdfToEpub(buffer, title = 'Sách chuyển từ PDF') {
  const pdf = await loadPdf(buffer)
  const chapters = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const text = await page.getTextContent()
      const paragraphs = extractPdfParagraphs(text.items)
      if (paragraphs.length) chapters.push({ title: `Trang ${i}`, paragraphs })
    }
  } finally { pdf.destroy() }
  if (!chapters.length) throw new Error('PDF ảnh quét không có lớp chữ để chuyển sang EPUB.')
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
  const manifest = []; const spine = []; const nav = []
  chapters.forEach((chapter, index) => {
    const name = `page${index + 1}.xhtml`; const id = `p${index + 1}`
    zip.file(`OEBPS/${name}`, `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi"><head><title>${esc(chapter.title)}</title></head><body><h1>${esc(chapter.title)}</h1>${chapter.paragraphs.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}</body></html>`)
    manifest.push(`<item id="${id}" href="${name}" media-type="application/xhtml+xml"/>`)
    spine.push(`<itemref idref="${id}"/>`)
    nav.push(`<li><a href="${name}">${esc(chapter.title)}</a></li>`)
  })
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Mục lục</title></head><body><nav epub:type="toc"><ol>${nav.join('')}</ol></nav></body></html>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="vi"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:language>vi</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
