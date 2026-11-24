import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Download, FileText, Minus, Plus, Search, X } from 'lucide-react'
import { ensureFile } from './storage'
import { loadPdf, pdfToEpub } from './book-utils'

export default function PdfReader({ bookInfo, onClose, onReflow, progress, setProgress, toast }) {
  const canvas = useRef(null)
  const documentRef = useRef(null)
  const bufferRef = useRef(null)
  const [pageNumber, setPageNumber] = useState(progress?.page || 1)
  const [pages, setPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [converting, setConverting] = useState(false)
  const readingSecondsRef = useRef(progress?.readingSeconds || 0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return
      readingSecondsRef.current += 30
      setProgress({ readingSeconds: readingSecondsRef.current })
    }, 30000)
    return () => clearInterval(timer)
  }, [bookInfo.id])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const buffer = await ensureFile(bookInfo.id, bookInfo.sha256)
        if (!buffer) throw new Error('Không tìm thấy tệp PDF trên thiết bị này.')
        bufferRef.current = buffer
        const doc = await loadPdf(buffer)
        if (cancelled) { doc.destroy(); return }
        documentRef.current = doc; setPages(doc.numPages)
      } catch (e) { if (!cancelled) setError(e.message) }
    }
    init()
    return () => { cancelled = true; documentRef.current?.destroy() }
  }, [bookInfo.id])

  useEffect(() => {
    const doc = documentRef.current
    if (!doc || !pages) return
    let cancelled = false; let task
    async function render() {
      const page = await doc.getPage(pageNumber)
      if (cancelled || !canvas.current) return
      const available = Math.max(280, window.innerWidth - (window.innerWidth < 700 ? 28 : 180))
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(2.5, available / base.width) * scale })
      const c = canvas.current
      c.width = Math.floor(viewport.width * devicePixelRatio)
      c.height = Math.floor(viewport.height * devicePixelRatio)
      c.style.width = `${viewport.width}px`; c.style.height = `${viewport.height}px`
      const context = c.getContext('2d'); context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      task = page.render({ canvasContext: context, viewport })
      await task.promise.catch(() => {})
      setProgress({ page: pageNumber, percent: Math.round(pageNumber / pages * 100), updated: Date.now() })
    }
    render().catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true; task?.cancel() }
  }, [pageNumber, pages, scale])

  async function find(e) {
    e.preventDefault()
    if (!query.trim() || !documentRef.current) return
    setSearching(true); const matches = []
    for (let i = 1; i <= pages; i++) {
      const page = await documentRef.current.getPage(i)
      const text = (await page.getTextContent()).items.map(item => item.str).join(' ')
      const at = text.toLocaleLowerCase('vi').indexOf(query.toLocaleLowerCase('vi'))
      if (at >= 0) matches.push({ page: i, excerpt: text.slice(Math.max(0, at - 45), at + query.length + 65) })
    }
    setResults(matches); setSearching(false)
  }

  async function convert() {
    setConverting(true)
    try {
      const blob = await pdfToEpub(bufferRef.current, bookInfo.title)
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${bookInfo.title}.epub`; link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 30000)
      toast('Đã tạo EPUB từ lớp chữ PDF. Hình ảnh và bố cục có thể thay đổi.')
    } catch (e) { toast(e.message) }
    finally { setConverting(false) }
  }

  return <div className="pdf-reader"><header><button onClick={onClose} aria-label="Về tủ sách"><ArrowLeft size={20}/></button><div><strong>{bookInfo.title}</strong><span>PDF · {pages || '…'} trang</span></div>{bookInfo.hasReflow && <button className="pdf-reflow" onClick={onReflow}><BookOpen size={16}/> Đọc như EPUB</button>}<button className="pdf-convert" onClick={convert} disabled={!pages || converting}><Download size={16}/>{converting ? 'Đang chuyển...' : 'Xuất EPUB'}</button></header><div className="pdf-layout"><aside className="pdf-aside"><h2>Tìm trong sách</h2><form onSubmit={find}><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm từ khóa trong PDF"/><button>Tìm</button></form>{searching && <p>Đang tìm...</p>}{results.map(r => <button className="pdf-result" key={r.page} onClick={() => setPageNumber(r.page)}><strong>Trang {r.page}</strong><span>{r.excerpt}</span></button>)}{query && !searching && results.length === 0 && <p className="pdf-help">PDF ảnh quét cần OCR để tìm chữ hoặc chuyển EPUB.</p>}<div className="pdf-tip"><FileText size={18}/><p>Bạn có thể đọc PDF trực tiếp. “Xuất EPUB” lấy lớp chữ để tạo bản đọc linh hoạt; bố cục hình ảnh không được giữ nguyên.</p></div></aside><main className="pdf-canvas-area">{error ? <div className="pdf-error">{error}</div> : <canvas ref={canvas}/>}</main></div><footer><button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber <= 1}><ChevronLeft size={19}/> Trước</button><span>Trang {pageNumber} / {pages || '…'}</span><button onClick={() => setPageNumber(Math.min(pages, pageNumber + 1))} disabled={pageNumber >= pages}>Sau <ChevronRight size={19}/></button><div className="pdf-zoom"><button onClick={() => setScale(Math.max(.7, scale - .1))}><Minus size={16}/></button>{Math.round(scale * 100)}%<button onClick={() => setScale(Math.min(2, scale + .1))}><Plus size={16}/></button></div></footer></div>
}
