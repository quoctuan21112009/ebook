import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ePub from 'epubjs'
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookMarked, BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, CloudUpload, Focus, Highlighter, LibraryBig, List, Menu, Minus, Moon, MoreHorizontal, PanelLeftClose, Plus, Search, Settings2, Sparkles, StickyNote, Sun, Trash2, X } from 'lucide-react'
import { deleteFile, getFile, loadJson, putFile, saveJson } from './storage'
import './style.css'

const demoBooks = [
  { id: 'demo-1', title: 'Những ngày chậm lại', author: 'Thư Các Studio', subtitle: 'Một khoảng lặng để trở về', tag: 'TẢN VĂN', palette: 'sage', file: '/books/nhung-ngay-cham-lai.epub', demo: true },
  { id: 'demo-2', title: 'Lời của khu vườn', author: 'Thư Các Studio', subtitle: 'Chuyện nhỏ bên hiên nhà', tag: 'TRUYỆN NGẮN', palette: 'terracotta', file: '/books/loi-cua-khu-vuon.epub', demo: true },
  { id: 'demo-3', title: 'Nghệ thuật học sâu', author: 'Thư Các Studio', subtitle: 'Đọc, nhớ và khám phá', tag: 'HỌC TẬP', palette: 'navy', file: '/books/nghe-thuat-hoc-sau.epub', demo: true },
]

const defaultPrefs = { fontSize: 18, font: 'serif', theme: 'paper', lineHeight: 1.7, margin: 60 }
const themes = [ { id: 'paper', label: 'Giấy ngà', color: '#f5ecd9' }, { id: 'white', label: 'Trắng ấm', color: '#fffdfa' }, { id: 'sepia', label: 'Nâu cổ', color: '#dec7a3' }, { id: 'night', label: 'Đêm', color: '#232927' } ]
const quotes = ['Mỗi trang sách là một cánh cửa mở ra thế giới mới.', 'Đọc một chút mỗi ngày, đi thật xa qua từng trang.', 'Có những câu chuyện chỉ cần mở sách là đã thấy mình.']

function Cover({ book, size = 'normal' }) {
  return <div className={`book-cover ${book.palette || 'plum'} ${size}`}>
    <div className="cover-ornament top">✦ <span>❧</span> ✦</div>
    <div className="cover-copy"><small>{book.tag || 'THƯ VIỆN CỦA BẠN'}</small><h3>{book.title}</h3><div className="cover-line" /><p>{book.subtitle || 'Một câu chuyện đang chờ bạn'}</p></div>
    <div className="cover-ornament bottom">✦</div>
    <div className="cover-author">{book.author || 'Không rõ tác giả'}</div>
  </div>
}

function App() {
  const [uploaded, setUploaded] = useState(() => loadJson('tc-books', []))
  const [progress, setProgress] = useState(() => loadJson('tc-progress', {}))
  const [annotations, setAnnotations] = useState(() => loadJson('tc-annotations', {}))
  const [prefs, setPrefs] = useState(() => loadJson('tc-prefs', defaultPrefs))
  const [active, setActive] = useState(null)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const fileInput = useRef(null)
  const books = [...demoBooks, ...uploaded]
  const filtered = books.filter(b => (tab === 'all' || (tab === 'reading' && progress[b.id]?.cfi) || (tab === 'saved' && annotations[b.id]?.some(a => a.type === 'bookmark'))) && `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase()))
  const recent = books.find(b => progress[b.id]?.cfi) || books[0]

  useEffect(() => saveJson('tc-books', uploaded), [uploaded])
  useEffect(() => saveJson('tc-progress', progress), [progress])
  useEffect(() => saveJson('tc-annotations', annotations), [annotations])
  useEffect(() => saveJson('tc-prefs', prefs), [prefs])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }, [toast])

  async function importFiles(files) {
    const epubFiles = [...files].filter(f => /\.epub$/i.test(f.name))
    if (!epubFiles.length) { setToast('Vui lòng chọn tệp .epub'); return }
    for (const file of epubFiles) {
      try {
        const buffer = await file.arrayBuffer()
        const book = ePub(buffer)
        await book.ready
        const meta = book.packaging.metadata
        const id = crypto.randomUUID()
        await putFile(id, buffer)
        setUploaded(current => [...current, { id, title: meta.title || file.name.replace(/\.epub$/i, ''), author: meta.creator || 'Không rõ tác giả', subtitle: 'Sách của bạn', tag: 'EPUB CỦA BẠN', palette: ['plum', 'navy', 'sage', 'terracotta'][current.length % 4], demo: false }])
        book.destroy()
        setToast(`Đã thêm “${meta.title || file.name}” vào tủ sách`)
        setUploadOpen(false)
      } catch (error) { console.error(error); setToast(`Không đọc được tệp ${file.name}. Kiểm tra định dạng EPUB.`) }
    }
  }

  async function removeBook(book) {
    if (book.demo || !confirm(`Xóa “${book.title}” khỏi tủ sách?`)) return
    await deleteFile(book.id)
    setUploaded(v => v.filter(b => b.id !== book.id))
    setProgress(v => { const next = { ...v }; delete next[book.id]; return next })
    setAnnotations(v => { const next = { ...v }; delete next[book.id]; return next })
    setToast('Đã xóa sách')
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
      <div className="brand"><div className="brand-mark"><BookOpen size={23} strokeWidth={1.7} /></div><div><strong>Thư Các</strong><span>THE READING ROOM</span></div></div>
      <div className="sidebar-label">KHÔNG GIAN CỦA BẠN</div>
      <nav className="main-nav">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => { setTab('all'); setMobileNav(false) }}><LibraryBig size={19} /> Tủ sách <span>{books.length}</span></button>
        <button className={tab === 'reading' ? 'active' : ''} onClick={() => { setTab('reading'); setMobileNav(false) }}><BookOpen size={19} /> Đang đọc</button>
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => { setTab('saved'); setMobileNav(false) }}><Bookmark size={19} /> Đánh dấu</button>
      </nav>
      <div className="sidebar-rule" />
      <div className="sidebar-label">GÓC CẢM HỨNG</div>
      <div className="sidebar-quote"><span>“</span><p>{quotes[0]}</p><div>— THƯ CÁC</div></div>
      <div className="sidebar-bottom"><div className="leaf-icon">❧</div><p>Một không gian nhỏ<br/>cho những ý tưởng lớn.</p></div>
    </aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={22} /></button><div className="breadcrumb">Không gian đọc <ChevronRight size={14} /> <b>Tủ sách của tôi</b></div><div className="top-actions"><div className="today-pill"><span className="sun-dot"/> MỘT NGÀY ĐẸP ĐỂ ĐỌC SÁCH</div><button className="avatar" aria-label="Hồ sơ">T</button></div></header>
      <div className="content">
        <section className="welcome"><div><div className="eyebrow"><span className="gold-line"/> CHÀO MỪNG BẠN TRỞ LẠI</div><h1>Mỗi cuốn sách, <em>một hành trình.</em></h1><p>Góc nhỏ bình yên dành riêng cho những câu chuyện của bạn.</p></div><div className="welcome-ornament">✦</div></section>
        <section className="hero-card"><div className="hero-grain"/><div className="hero-text"><span className="hero-kicker"><Sparkles size={14}/> GÓC ĐỌC HÔM NAY</span><h2>Tiếp tục nơi<br/><i>câu chuyện dừng lại.</i></h2><p>Một vài phút đọc sách cũng đủ làm ngày hôm nay khác đi.</p><button className="primary-btn" onClick={() => setActive(recent)}>Mở sách đọc tiếp <ArrowRight size={17}/></button></div><div className="hero-scene"><div className="hero-halo"/><div className="hero-book"><Cover book={recent} size="hero" /></div><div className="hero-book-shadow"/><div className="hero-spark s1">✧</div><div className="hero-spark s2">✦</div></div><div className="hero-number">01 / 03</div></section>
        <section className="library-section"><div className="section-heading"><div><div className="eyebrow small">BỘ SƯU TẬP CỦA BẠN</div><h2>Tủ sách của tôi <span>({books.length})</span></h2></div><button className="outline-btn" onClick={() => setUploadOpen(true)}><Plus size={17}/> Thêm sách EPUB</button></div>
          <div className="library-toolbar"><div className="tabs"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>Tất cả <span>{books.length}</span></button><button className={tab === 'reading' ? 'selected' : ''} onClick={() => setTab('reading')}>Đang đọc</button><button className={tab === 'saved' ? 'selected' : ''} onClick={() => setTab('saved')}>Đã đánh dấu</button></div><div className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm trong tủ sách..." aria-label="Tìm sách" /></div></div>
          <div className="shelf-stage"><div className="shelf-back"><div className="books-grid">{filtered.map((book, index) => <div className="shelf-item" key={book.id} style={{ '--i': index }}><button className="cover-button" onClick={() => setActive(book)} aria-label={`Đọc ${book.title}`}><Cover book={book} /></button><div className="book-meta"><div><h3>{book.title}</h3><p>{book.author}</p></div>{!book.demo && <button className="book-menu icon-button" onClick={() => removeBook(book)} title="Xóa sách" aria-label={`Xóa ${book.title}`}><Trash2 size={15}/></button>}</div><div className="book-progress"><div style={{ width: `${progress[book.id]?.percent || 0}%` }}/></div><small>{progress[book.id]?.percent ? `Đã đọc ${progress[book.id].percent}%` : 'Chưa bắt đầu'}</small></div>)}<button className="add-book-card" onClick={() => setUploadOpen(true)}><div className="add-icon"><Plus size={27}/></div><strong>Thêm một câu chuyện</strong><span>Tải lên tệp EPUB của bạn</span></button></div></div><div className="shelf-board"/></div>
          {filtered.length === 0 && <div className="empty-state">Chưa có sách nào ở mục này. <button onClick={() => { setTab('all'); setQuery('') }}>Xem tất cả</button></div>}
        </section>
        <footer className="site-footer"><span>❧</span> THƯ CÁC · MỘT GÓC NHỎ ĐỂ ĐỌC VÀ NGHĨ <span>❧</span></footer>
      </div>
    </main>
    {uploadOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setUploadOpen(false) }}><div className="upload-modal"><button className="modal-close icon-button" onClick={() => setUploadOpen(false)} aria-label="Đóng"><X size={20}/></button><div className="modal-emblem"><CloudUpload size={28}/></div><div className="eyebrow small">MỞ THÊM MỘT THẾ GIỚI</div><h2>Đưa sách lên kệ</h2><p>Chọn sách EPUB để bắt đầu hành trình đọc của riêng bạn. Sách chỉ lưu trên thiết bị này.</p><div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); importFiles(e.dataTransfer.files) }} onClick={() => fileInput.current?.click()}><BookOpen size={29}/><strong>Kéo thả tệp EPUB vào đây</strong><span>hoặc nhấn để chọn từ thiết bị</span><input ref={fileInput} type="file" accept=".epub,application/epub+zip" multiple hidden onChange={e => { importFiles(e.target.files); e.target.value = '' }}/></div><small>Hỗ trợ định dạng .epub · Có thể chọn nhiều sách</small></div></div>}
    {active && <Reader key={active.id} bookInfo={active} onClose={() => setActive(null)} prefs={prefs} setPrefs={setPrefs} progress={progress[active.id]} setProgress={value => setProgress(v => ({ ...v, [active.id]: value }))} annotations={annotations[active.id] || []} setAnnotations={value => setAnnotations(v => ({ ...v, [active.id]: value }))} toast={setToast} />}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function Reader({ bookInfo, onClose, prefs, setPrefs, progress, setProgress, annotations, setAnnotations, toast }) {
  const viewer = useRef(null)
  const rendition = useRef(null)
  const epubBook = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState('')
  const [toc, setToc] = useState([])
  const [chapter, setChapter] = useState('')
  const [percent, setPercent] = useState(progress?.percent || 0)
  const [selection, setSelection] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [focus, setFocus] = useState(false)
  const [minutes, setMinutes] = useState(25)
  const [running, setRunning] = useState(false)
  const [flip, setFlip] = useState('')
  const locationRef = useRef(progress?.cfi)

  useEffect(() => {
    if (!running || minutes <= 0) return
    const timer = setInterval(() => setMinutes(m => Math.max(0, m - 1 / 60)), 1000)
    return () => clearInterval(timer)
  }, [running, minutes <= 0])

  useEffect(() => {
    let cancelled = false
    let localBook
    async function init() {
      try {
        const data = bookInfo.demo ? await fetch(bookInfo.file).then(r => { if (!r.ok) throw new Error('Không tải được sách mẫu'); return r.arrayBuffer() }) : await getFile(bookInfo.id)
        if (!data) throw new Error('Không tìm thấy tệp sách trên thiết bị này')
        if (cancelled) return
        localBook = ePub(data)
        epubBook.current = localBook
        await localBook.ready
        if (cancelled) return
        const navigation = await localBook.loaded.navigation
        setToc(navigation.toc || [])
        const r = localBook.renderTo(viewer.current, { width: '100%', height: '100%', flow: 'paginated', spread: 'auto', minSpreadWidth: 800, allowScriptedContent: false })
        rendition.current = r
        r.on('relocated', loc => {
          if (!loc?.start) return
          locationRef.current = loc.start.cfi
          const percentage = localBook.locations?.length() ? Math.round(localBook.locations.percentageFromCfi(loc.start.cfi) * 100) : Math.round((loc.start.percentage || 0) * 100)
          const safePercent = Math.max(0, Math.min(100, percentage || 0))
          setPercent(safePercent)
          setProgress({ cfi: loc.start.cfi, percent: safePercent, updated: Date.now() })
          const item = localBook.navigation?.get(loc.start.href)
          setChapter(item?.label?.trim() || 'Đang đọc')
        })
        r.on('selected', (cfiRange, contents) => {
          const text = contents.window.getSelection()?.toString().trim()
          if (text) { setSelection({ cfi: cfiRange, text }); setPanel('selection') }
        })
        await r.display(locationRef.current || undefined)
        setLoading(false)
        localBook.locations.generate(900).then(() => { if (!cancelled && locationRef.current) { const p = Math.round(localBook.locations.percentageFromCfi(locationRef.current) * 100); if (Number.isFinite(p)) setPercent(p) } }).catch(() => {})
      } catch (e) { if (!cancelled) { console.error(e); setError(e.message || 'Không thể mở sách'); setLoading(false) } }
    }
    init()
    return () => { cancelled = true; rendition.current?.destroy(); localBook?.destroy(); rendition.current = null; epubBook.current = null }
  }, [bookInfo.id])

  useEffect(() => {
    const r = rendition.current
    if (!r) return
    const colors = { paper: ['#f5ecd9', '#332b24'], white: ['#fffdfa', '#252522'], sepia: ['#dec7a3', '#3b2b1e'], night: ['#232927', '#e7dfce'] }
    const [bg, fg] = colors[prefs.theme] || colors.paper
    r.themes.default({ body: { color: `${fg} !important`, background: `${bg} !important`, 'font-family': `${prefs.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif'} !important`, 'font-size': `${prefs.fontSize}px !important`, 'line-height': `${prefs.lineHeight} !important`, 'padding-left': `${prefs.margin / 3}px !important`, 'padding-right': `${prefs.margin / 3}px !important` }, p: { 'line-height': `${prefs.lineHeight} !important` }, a: { color: '#a06b40 !important' } })
    r.themes.fontSize(`${prefs.fontSize}px`)
  }, [prefs, loading])

  useEffect(() => {
    const r = rendition.current
    if (!r) return
    annotations.filter(a => a.type === 'highlight').forEach(a => { try { r.annotations.highlight(a.cfi, {}, () => {}, `highlight-${a.id}`, { fill: '#d7ad59', 'fill-opacity': '0.45' }) } catch {} })
  }, [annotations, loading])

  function page(direction) {
    const r = rendition.current
    if (!r) return
    setFlip(direction)
    setTimeout(() => setFlip(''), 420)
    if (direction === 'next') r.next(); else r.prev()
  }
  useEffect(() => {
    const onKey = event => {
      if (panel || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowRight') page('next')
      if (event.key === 'ArrowLeft') page('prev')
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])
  function addHighlight() {
    if (!selection) return
    setAnnotations([...annotations, { id: crypto.randomUUID(), type: 'highlight', cfi: selection.cfi, text: selection.text, note: noteText, date: Date.now() }])
    setSelection(null); setNoteText(''); setPanel(''); toast('Đã lưu đoạn bôi đậm')
  }
  function addBookmark() {
    if (!locationRef.current) return
    setAnnotations([...annotations, { id: crypto.randomUUID(), type: 'bookmark', cfi: locationRef.current, text: chapter || 'Trang đang đọc', date: Date.now() }]); toast('Đã đánh dấu trang')
  }
  function removeAnnotation(id) { setAnnotations(annotations.filter(a => a.id !== id)); toast('Đã xóa ghi chú') }
  function goTo(cfi) { rendition.current?.display(cfi); setPanel('') }
  function changePref(key, value) { setPrefs(p => ({ ...p, [key]: value })) }

  return <div className={`reader ${focus ? 'focus-mode' : ''} theme-${prefs.theme}`}>
    <header className="reader-header"><div className="reader-header-left"><button className="reader-icon" onClick={onClose} aria-label="Về tủ sách"><ArrowLeft size={20}/></button><div className="reader-divider"/><div className="reader-book-title"><strong>{bookInfo.title}</strong><span>{bookInfo.author}</span></div></div><div className="reader-center"><span className="reader-dot"/> {chapter || 'Không gian đọc'}</div><div className="reader-actions"><button className={`reader-icon ${panel === 'toc' ? 'on' : ''}`} onClick={() => setPanel(panel === 'toc' ? '' : 'toc')} title="Mục lục" aria-label="Mục lục"><List size={20}/></button><button className="reader-icon" onClick={addBookmark} title="Đánh dấu trang" aria-label="Đánh dấu trang"><Bookmark size={19}/></button><button className={`reader-icon ${panel === 'notes' ? 'on' : ''}`} onClick={() => setPanel(panel === 'notes' ? '' : 'notes')} title="Ghi chú" aria-label="Ghi chú"><StickyNote size={19}/></button><button className={`reader-icon ${panel === 'settings' ? 'on' : ''}`} onClick={() => setPanel(panel === 'settings' ? '' : 'settings')} title="Tùy chỉnh đọc" aria-label="Tùy chỉnh đọc"><Settings2 size={20}/></button><div className="reader-divider"/><button className={`reader-icon ${focus ? 'on' : ''}`} onClick={() => { setFocus(!focus); setPanel('') }} title="Chế độ tập trung" aria-label="Chế độ tập trung"><Focus size={20}/></button></div></header>
    <div className="reader-body"><div className="reader-ambient"/><button className="page-arrow left" onClick={() => page('prev')} aria-label="Trang trước"><ChevronLeft size={26}/></button><div className={`paper-book flip-${flip}`}><div className="paper-spine"/><div className="epub-view" ref={viewer}/>{loading && <div className="reader-loading"><BookOpen size={36}/><p>Đang mở những trang sách...</p></div>}{error && <div className="reader-loading error"><BookOpen size={36}/><p>{error}</p><button onClick={onClose}>Trở về tủ sách</button></div>}</div><button className="page-arrow right" onClick={() => page('next')} aria-label="Trang tiếp"><ChevronRight size={26}/></button></div>
    <footer className="reader-footer"><button onClick={() => setPanel('toc')}><List size={15}/> Mục lục</button><div className="reading-progress"><span>{percent}%</span><div className="progress-track"><div style={{ width: `${percent}%` }}/></div><span>Hoàn thành</span></div><div className="footer-right"><button onClick={() => setPanel(panel === 'timer' ? '' : 'timer')}><Clock3 size={15}/> {running ? `${String(Math.floor(minutes)).padStart(2,'0')}:${String(Math.floor((minutes % 1) * 60)).padStart(2,'0')}` : 'Tập trung'}</button><span className="footer-hint">← → để lật trang</span></div></footer>
    {panel && <><div className="reader-panel-scrim" onClick={() => { setPanel(''); setSelection(null) }}/><aside className="reader-panel"><div className="panel-head"><div><span className="eyebrow small">THƯ CÁC</span><h2>{{ toc: 'Mục lục', notes: 'Sổ tay đọc sách', settings: 'Tùy chỉnh đọc', selection: 'Lưu điều hay', timer: 'Thời gian tập trung' }[panel]}</h2></div><button className="reader-icon" onClick={() => { setPanel(''); setSelection(null) }} aria-label="Đóng"><X size={20}/></button></div>
      {panel === 'toc' && <div className="panel-scroll"><p className="panel-intro">Chọn một chương để bắt đầu đọc.</p>{toc.map((item, i) => <button className="toc-item" key={`${item.href}-${i}`} onClick={() => goTo(item.href)}><span>{String(i+1).padStart(2,'0')}</span>{item.label?.trim()}<ChevronRight size={16}/></button>)}</div>}
      {panel === 'notes' && <div className="panel-scroll"><p className="panel-intro">Những ý tưởng bạn muốn giữ lại, ngay cạnh trang sách.</p>{annotations.length ? [...annotations].reverse().map(a => <div className="annotation-card" key={a.id}><div className="annotation-type">{a.type === 'bookmark' ? <Bookmark size={14}/> : <Highlighter size={14}/>} {a.type === 'bookmark' ? 'ĐÁNH DẤU' : 'BÔI ĐẬM'}</div><button className="annotation-text" onClick={() => goTo(a.cfi)}>{a.text}</button>{a.note && <p>{a.note}</p>}<button className="annotation-delete" onClick={() => removeAnnotation(a.id)}><Trash2 size={14}/> Xóa</button></div>) : <div className="panel-empty"><StickyNote size={29}/><strong>Chưa có ghi chú nào</strong><span>Chọn một đoạn văn trong sách để bôi đậm và ghi lại suy nghĩ.</span></div>}</div>}
      {panel === 'settings' && <div className="panel-scroll settings-content"><div className="setting-group"><label>KIỂU CHỮ</label><div className="font-options"><button className={prefs.font === 'serif' ? 'chosen' : ''} onClick={() => changePref('font', 'serif')}><span className="serif-preview">Aa</span> Cổ điển</button><button className={prefs.font === 'sans' ? 'chosen' : ''} onClick={() => changePref('font', 'sans')}><span className="sans-preview">Aa</span> Hiện đại</button></div></div><div className="setting-group"><label>CỠ CHỮ <b>{prefs.fontSize}px</b></label><div className="stepper"><button onClick={() => changePref('fontSize', Math.max(12, prefs.fontSize-1))}><Minus size={17}/></button><input type="range" min="12" max="30" value={prefs.fontSize} onChange={e => changePref('fontSize', +e.target.value)}/><button onClick={() => changePref('fontSize', Math.min(30, prefs.fontSize+1))}><Plus size={17}/></button></div></div><div className="setting-group"><label>NỀN GIẤY</label><div className="theme-options">{themes.map(t => <button key={t.id} className={prefs.theme === t.id ? 'chosen' : ''} onClick={() => changePref('theme', t.id)}><span style={{ background: t.color }}>{prefs.theme === t.id && <Check size={16}/>}</span>{t.label}</button>)}</div></div><div className="setting-group"><label>GIÃN DÒNG <b>{prefs.lineHeight.toFixed(1)}</b></label><input className="full-range" type="range" min="1.3" max="2.2" step="0.1" value={prefs.lineHeight} onChange={e => changePref('lineHeight', +e.target.value)}/></div><div className="settings-foot">Tùy chỉnh được lưu tự động cho những lần đọc sau.</div></div>}
      {panel === 'selection' && <div className="panel-scroll"><div className="quote-card">“{selection?.text}”</div><label className="note-label">GHI CHÚ CỦA BẠN</label><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Điều gì ở đoạn này khiến bạn muốn nhớ?" rows="5"/><button className="save-note-btn" onClick={addHighlight}><Highlighter size={17}/> Lưu đoạn này</button></div>}
      {panel === 'timer' && <div className="panel-scroll timer-panel"><div className="timer-circle"><Clock3 size={27}/><strong>{String(Math.floor(minutes)).padStart(2,'0')}:{String(Math.floor((minutes % 1)*60)).padStart(2,'0')}</strong><span>PHÚT TẬP TRUNG</span></div><p>Dành trọn một khoảng thời gian cho trang sách này.</p><button className="save-note-btn" onClick={() => setRunning(!running)}>{running ? 'Tạm dừng' : 'Bắt đầu đọc'}</button><button className="timer-reset" onClick={() => { setRunning(false); setMinutes(25) }}>Đặt lại 25 phút</button></div>}
    </aside></>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
