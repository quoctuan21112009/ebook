import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, BookOpen, Bookmark, Check, ChevronRight, Clock3, CloudUpload, LibraryBig, Menu, Plus, Search, Sparkles, Star, Trash2, X, MessageCircle, Users, LogOut, FileText } from 'lucide-react'
import { deleteFile, getFile, loadJson, putFile, saveJson } from './storage'
import { extractEpubCover, pdfCover, pdfToEpub, suggestQuoteFromEpub, suggestQuoteFromPdf } from './book-utils'
import { exportBackup, importBackup } from './backup'
import { readApiJson } from './api'
import { clearLocalSession, localSession } from './local-auth'
import Auth from './Auth'
import { AiHub, MusicDock } from './Extras'
import Community from './Community'
import QuoteStudio from './QuoteStudio'
import FlipbookReader from './FlipbookReader'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/700.css'
import './style.css'
import './upgrades.css'
import './social.css'
import './illustrated.css'
import './assistant.css'

const defaultPrefs = { readerVersion: 2, repairFlow: true, fontSize: 20, font: 'serif', theme: 'white', lineHeight: 1.7, margin: 60, lineChars: 62, paragraphIndent: 1.2, paragraphGap: 0.55 }

function paperSound() {
  try {
    const context = new AudioContext()
    const length = Math.round(context.sampleRate * .24)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / length) * .35
    const source = context.createBufferSource(); source.buffer = buffer
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1900
    const gain = context.createGain(); gain.gain.value = .045
    source.connect(filter); filter.connect(gain); gain.connect(context.destination)
    source.start(); source.onended = () => context.close()
  } catch {}
}

function Cover({ book, size = 'normal' }) {
  return <div className={`book-cover ${book.palette || 'plum'} ${size} ${book.coverUrl ? 'real-cover' : ''}`}>
    {book.coverUrl ? <img src={book.coverUrl} alt={`Bìa ${book.title}`} /> : <><div className="cover-ornament top">✦ <span>❧</span> ✦</div><div className="cover-copy"><small>{book.type === 'pdf' ? 'TÀI LIỆU PDF' : 'SÁCH EPUB'}</small><h3>{book.title}</h3><div className="cover-line"/><p>{book.author || 'Tủ sách của bạn'}</p></div><div className="cover-ornament bottom">✦</div></>}
  </div>
}

function BookDetail({ book, onClose, onRead, onUpdate, onDelete, onMerged, toast }) {
  const [quote, setQuote] = useState(book.quote || '')
  const [rating, setRating] = useState(book.rating || 0)
  const [title, setTitle] = useState(book.title || '')
  const [author, setAuthor] = useState(book.author || '')
  const [genre, setGenre] = useState(book.genre || '')
  const [tags, setTags] = useState((book.tags || []).join(', '))
  const [proposals, setProposals] = useState([])
  useEffect(() => { if (book.mine && book.visibility === 'public' && !book.localOnly) fetch(`/api/books/${book.id}/proposals`).then(r=>readApiJson(r)).then(data=>setProposals(data.proposals||[])).catch(()=>{}) }, [book.id])
  async function resolveProposal(id, accept) {
    const response = await fetch(`/api/proposals/${id}/resolve`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accept}) })
    const result = await readApiJson(response)
    if (!response.ok) { toast(result.error || 'Không xử lý được đề xuất.'); return }
    if (accept) { await deleteFile(book.id); localStorage.removeItem(`tc-file-hash:${book.id}`); await onMerged() }
    setProposals(v=>v.filter(p=>p.id!==id)); toast(accept?'Đã nhận bản sách mới.':'Đã từ chối đề xuất.')
  }
  function save() { onUpdate({ ...book, title: title.trim() || book.title, author: author.trim(), genre: genre.trim(), tags: tags.split(',').map(t=>t.trim()).filter(Boolean), quote: quote.trim(), rating }); onClose() }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="detail-modal"><button className="modal-close icon-button" onClick={onClose} aria-label="Đóng"><X size={20}/></button><div className="detail-cover"><Cover book={book} size="hero"/></div><div className="detail-content"><div className="eyebrow small">{book.type?.toUpperCase() || 'EPUB'} · {book.visibility === 'public' ? 'SÁCH CỘNG ĐỒNG' : 'SÁCH RIÊNG TƯ'}</div><h2>{book.title}</h2><p className="detail-author">{book.author || 'Không rõ tác giả'} · {book.visibility === 'public' ? `Đóng góp bởi ${book.uploader}` : 'Sách riêng tư'}</p>{book.mine && <div className="metadata-form"><label>CHỈNH THÔNG TIN SÁCH</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tên sách"/><input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Tác giả"/><input value={genre} onChange={e=>setGenre(e.target.value)} placeholder="Thể loại"/><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="Thẻ, cách nhau bằng dấu phẩy"/></div>}<label>ĐÁNH GIÁ CỦA BẠN</label><div className="rating-stars">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} aria-label={`${n} sao`}><Star size={23} fill={n <= rating ? '#cb923e' : 'none'} color={n <= rating ? '#cb923e' : '#a9a599'}/></button>)}</div><label>CÂU TRÍCH DẪN ĐÁNG NHỚ</label><textarea value={quote} onChange={e => setQuote(e.target.value)} rows="4" placeholder="Ghi lại câu bạn muốn nhớ từ cuốn sách..."/>{proposals.length>0 && <div className="merge-proposals"><label>ĐỀ XUẤT BẢN SÁCH TỐT HƠN</label>{proposals.map(p=><div key={p.id}><strong>{p.username}</strong><small>{p.note||'Bản mới'}</small><a href={`/api/proposals/${p.id}/file`} download>Tải xem bản đề xuất</a><button onClick={()=>resolveProposal(p.id,true)}>Nhận bản mới</button><button onClick={()=>resolveProposal(p.id,false)}>Từ chối</button></div>)}</div>}<div className="detail-actions"><button className="feature-primary" onClick={save}><Check size={17}/> Lưu thông tin</button><button className="detail-read" onClick={() => { save(); onRead(book) }}><BookOpen size={17}/> Mở sách</button></div>{book.mine && <button className="detail-delete" onClick={() => { onDelete(book); onClose() }}><Trash2 size={14}/> Xóa sách</button>}</div></div></div>
}

function LibraryIntro({ user, books, recent, progress, query, setQuery, onRead, onUpload, nav }) {
  const completed = books.filter(book => (progress[book.id]?.percent || 0) >= 100).length
  const reading = books.filter(book => progress[book.id]?.updated && (progress[book.id]?.percent || 0) < 100).length
  const minutes = Math.floor(Object.values(progress).reduce((sum, item) => sum + (item.readingSeconds || 0), 0) / 60)
  const recommendation = books.find(book => book.id !== recent?.id) || recent
  return <>
    <section className="scene-hero" aria-label="Thư phòng nhìn ra thiên nhiên">
      <div className="scene-copy">
        <span className="scene-kicker">— &nbsp; THƯ VIỆN CỦA {user.toLocaleUpperCase('vi')} &nbsp; —</span>
        <h1>Mỗi cuốn sách,<br/><em>một hành trình.</em></h1>
        <p>Góc nhỏ riêng để đọc, suy ngẫm và trưởng thành.</p>
        <label className="scene-search"><Search size={21}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sách, tác giả, thể loại..." aria-label="Tìm sách trong thư viện"/><span><ArrowRight size={19}/></span></label>
      </div>
    </section>
    <section className="reading-stats" aria-label="Thống kê đọc sách">
      <div><BookOpen size={22}/><strong>{books.length}</strong><span>Cuốn sách</span></div>
      <div><Bookmark size={22}/><strong>{completed}</strong><span>Đã đọc xong</span></div>
      <div><Clock3 size={22}/><strong>{minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)}h ${minutes % 60}p`}</strong><span>Thời gian đọc</span></div>
      <div><Sparkles size={22}/><strong>{reading}</strong><span>Đang đọc</span></div>
      <button onClick={() => nav('discussion')}><span>Đấu trường quan điểm</span><ArrowRight size={17}/></button>
    </section>
    <section className="reading-dashboard">
      <article className="continue-card">
        <h2><span>✒</span> Đang đọc</h2>
        {recent ? <div className="continue-content"><button className="continue-cover" onClick={() => onRead(recent)} aria-label={`Đọc ${recent.title}`}><Cover book={recent}/></button><div className="continue-info"><h3>{recent.title}</h3><p>{recent.author || 'Không rõ tác giả'}</p><div className="continue-progress"><div><span style={{width:`${progress[recent.id]?.percent || 0}%`}}/></div><strong>{progress[recent.id]?.percent || 0}%</strong></div><blockquote>{recent.quote ? `“${recent.quote}”` : '“Sách mở ra một thế giới mới, nơi bạn có thể là chính mình.”'}</blockquote><button onClick={() => onRead(recent)}><BookOpen size={16}/> Tiếp tục đọc <ArrowRight size={15}/></button></div></div> : <div className="continue-empty"><p>Tủ sách đang chờ cuốn đầu tiên của bạn.</p><button onClick={onUpload}><Plus size={17}/> Thêm sách của bạn</button></div>}
      </article>
      <article className="recommend-card">
        <h2><Star size={20}/> Gợi ý hôm nay</h2>
        {recommendation ? <div className="recommend-content"><button className="recommend-cover" onClick={() => onRead(recommendation)} aria-label={`Đọc ${recommendation.title}`}><Cover book={recommendation}/></button><div><h3>{recommendation.title}</h3><p>{recommendation.author || 'Không rõ tác giả'}</p><small>{recommendation.quote || 'Một hành trình mới đang chờ bạn khám phá.'}</small><button onClick={() => onRead(recommendation)}>Đọc ngay <ArrowRight size={15}/></button></div></div> : <div className="recommend-empty">Một trang sách mới, một chân trời mới.</div>}
      </article>
    </section>
  </>
}

function Discovery({ books, progress, onRead, onGenre }) {
  const publicBooks = books.filter(book => book.visibility === 'public')
    .sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0) || (b.added || 0) - (a.added || 0))
    .slice(0, 12)
  const continuing = books.filter(book => (progress[book.id]?.percent || 0) > 0 && (progress[book.id]?.percent || 0) < 100).slice(0, 8)
  const newest = [...books].sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 12)
  const genres = [...new Set(books.map(book => book.genre).filter(Boolean))].slice(0, 8)
  const rail = (title, subtitle, items) => items.length > 0 && <div className="discovery-rail"><div className="discovery-heading"><div><span>{subtitle}</span><h2>{title}</h2></div><span className="rail-hint">Kéo ngang để xem thêm →</span></div><div className="rail-track">{items.map(book => <button className="rail-book" key={book.id} onClick={() => onRead(book)} aria-label={`Đọc ${book.title}`}><Cover book={book}/><strong>{book.title}</strong><small>{book.author || 'Không rõ tác giả'}</small><span>{book.genre || (book.visibility === 'public' ? 'Sách cộng đồng' : 'Tủ sách của bạn')}</span></button>)}</div></div>
  return <section className="discovery" aria-label="Khám phá sách">
    {rail('Đọc tiếp hành trình', 'DÀNH RIÊNG CHO BẠN', continuing)}
    {rail('Mới thêm vào tủ sách', 'SÁCH VỪA LÊN KỆ', newest)}
    {rail('Sách cộng đồng nổi bật', 'KHÁM PHÁ VÀ TRANH LUẬN', publicBooks)}
    {genres.length > 0 && <div className="genre-row"><strong>Khám phá theo thể loại</strong><div>{genres.map(genre => <button key={genre} onClick={() => onGenre(genre)}>{genre}</button>)}</div></div>}
  </section>
}

function AppContent({ user, onLogout, offline = false }) {
  const key = field => `tc-${field}:${user}`
  const [uploaded, setUploaded] = useState(() => loadJson(key('books'), []).map(b => ({ ...b, type: b.type || 'epub' })))
  const [serverBooks, setServerBooks] = useState([])
  const [serverLoaded, setServerLoaded] = useState(false)
  const [dirtyId, setDirtyId] = useState(null)
  const [progress, setProgress] = useState(() => loadJson(key('progress'), {}))
  const [annotations, setAnnotations] = useState(() => loadJson(key('annotations'), {}))
  const [prefs, setPrefs] = useState(() => { const saved=loadJson(key('prefs'),defaultPrefs); return saved.readerVersion===2?saved:{...defaultPrefs,...saved,theme:'white',readerVersion:2} })
  const [covers, setCovers] = useState({})
  const [active, setActive] = useState(null)
  const [quoteDraft, setQuoteDraft] = useState(null)
  const [detail, setDetail] = useState(null)
  const [view, setView] = useState('library')
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [uploaderFilter, setUploaderFilter] = useState('')
  const [sortBy, setSortBy] = useState('new')
  const [toast, setToast] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [visibility, setVisibility] = useState('private')
  const [rights, setRights] = useState(false)
  const [uploadQuote, setUploadQuote] = useState('')
  const [uploadGenre, setUploadGenre] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const fileInput = useRef(null)
  const backupInput = useRef(null)
  const books = [...serverBooks, ...uploaded.filter(b => !serverBooks.some(s => s.id === b.id)).map(b => ({ ...b, coverUrl: covers[b.id], localOnly: true, mine: true, visibility: 'private' }))]
  const personalBooks = books.filter(b => b.mine)
  const filtered = personalBooks.filter(b => (tab === 'all' || (tab === 'reading' && progress[b.id]?.updated) || (tab === 'saved' && annotations[b.id]?.some(a => a.type === 'bookmark'))) && `${b.title} ${b.author} ${b.quote || ''} ${(b.tags||[]).join(' ')}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) && (!genreFilter || b.genre === genreFilter) && (!uploaderFilter || b.uploader === uploaderFilter) && (!tagFilter || (b.tags||[]).includes(tagFilter))).sort((a,b) => sortBy === 'hot' ? (b.commentCount||0)-(a.commentCount||0) : (b.added||0)-(a.added||0))
  const recent = [...books].filter(b => progress[b.id]?.updated && (progress[b.id]?.percent || 0) < 100).sort((a,b) => progress[b.id].updated - progress[a.id].updated)[0] || null

  useEffect(() => saveJson(key('books'), uploaded), [uploaded])
  useEffect(() => saveJson(key('progress'), progress), [progress])
  useEffect(() => saveJson(key('annotations'), annotations), [annotations])
  useEffect(() => saveJson(key('prefs'), prefs), [prefs])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t) }, [toast])
  useEffect(() => {
    if (offline) { setServerLoaded(true); return }
    let cancelled = false
    async function loadServer() {
      try {
        const response = await fetch('/api/books')
        if (!response.ok) throw new Error('Không tải được thư viện cộng đồng.')
        const { books: remote } = await readApiJson(response)
        const states = await Promise.all(remote.map(b => fetch(`/api/books/${b.id}/state`).then(r => r.ok ? readApiJson(r) : null).catch(() => null)))
        if (cancelled) return
        const remoteProgress = {}, remoteAnnotations = {}
        const enriched = remote.map((b, index) => {
          const state = states[index]
          if (state?.progress) remoteProgress[b.id] = state.progress
          if (state?.annotations) remoteAnnotations[b.id] = state.annotations
          return { ...b, rating: state?.rating || 0, quote: state?.personalQuote || b.quote || '' }
        })
        setProgress(v => ({ ...v, ...remoteProgress }))
        setAnnotations(v => ({ ...v, ...remoteAnnotations }))
        setServerBooks(enriched)
        setServerLoaded(true)
      } catch (e) { if (!cancelled) setToast(e.message) }
    }
    loadServer()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!dirtyId || !serverLoaded || !serverBooks.some(b => b.id === dirtyId)) return
    const timer = setTimeout(async () => {
      const book = serverBooks.find(b => b.id === dirtyId)
      await fetch(`/api/books/${dirtyId}/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: progress[dirtyId], annotations: annotations[dirtyId] || [], rating: book.rating || 0, personalQuote: book.quote || '' }) }).catch(console.error)
      setDirtyId(null)
    }, 750)
    return () => clearTimeout(timer)
  }, [dirtyId, progress, annotations, serverBooks, serverLoaded])
  useEffect(() => {
    let mounted = true; const urls = []
    Promise.all(uploaded.map(async b => { const blob = await getFile(`${b.id}:cover`); if (blob) { const url = URL.createObjectURL(blob); urls.push(url); return [b.id, url] } return null })).then(entries => { if (mounted) setCovers(Object.fromEntries(entries.filter(Boolean))) }).catch(console.error)
    return () => { mounted = false; urls.forEach(URL.revokeObjectURL) }
  }, [uploaded])

  async function importFiles(files) {
    if (visibility === 'public' && !rights) { setToast('Hãy xác nhận quyền chia sẻ trước khi đăng sách công khai.'); return }
    const supported = [...files].filter(f => /\.(epub|pdf)$/i.test(f.name))
    if (!supported.length) { setToast('Hãy chọn tệp EPUB hoặc PDF.'); return }
    for (const file of supported) {
      const type = /\.pdf$/i.test(file.name) ? 'pdf' : 'epub'
      try {
        const buffer = await file.arrayBuffer()
        let title = file.name.replace(/\.(epub|pdf)$/i, '')
        let author = 'Không rõ tác giả'; let cover = null
        if (type === 'epub') {
          const { default: ePub } = await import('epubjs')
          const epub = ePub(buffer); await epub.ready
          title = epub.packaging.metadata.title?.trim() || title
          author = epub.packaging.metadata.creator?.trim() || author
          cover = await extractEpubCover(buffer).catch(() => null)
          epub.destroy()
        } else cover = await pdfCover(buffer)
        const normalized = type === 'pdf' ? await pdfToEpub(buffer, title).catch(() => null) : null
        const quote = uploadQuote.trim() || (type === 'epub' ? await suggestQuoteFromEpub(buffer).catch(() => '') : await suggestQuoteFromPdf(buffer).catch(() => ''))
        if (offline) {
          const id = crypto.randomUUID()
          await putFile(id, buffer)
          if (cover) await putFile(`${id}:cover`, cover)
          if (normalized) await putFile(`${id}:reflow:v2`, await normalized.arrayBuffer())
          setUploaded(current => [{ id, title, author, type, quote, genre: uploadGenre.trim(), tags: uploadTags.split(',').map(tag => tag.trim()).filter(Boolean), uploader: user, added: Date.now(), hasReflow: !!normalized, visibility: 'private', mine: true, localOnly: true }, ...current])
          setToast(`Đã lưu “${title}” trên thiết bị này`)
          setUploadOpen(false); setUploadQuote(''); setUploadGenre(''); setUploadTags('')
          continue
        }
        const form = new FormData()
        form.append('file', file); if (cover) form.append('cover', cover, 'cover.' + (cover.type.includes('svg') ? 'svg' : cover.type.includes('png') ? 'png' : 'jpg'))
        if (normalized) form.append('normalized', normalized, `${title}.epub`)
        form.append('title', title); form.append('author', author); form.append('genre', uploadGenre); form.append('tags', uploadTags); form.append('quote', quote); form.append('visibility', visibility); form.append('rights', String(rights))
        const response = await fetch('/api/books', { method: 'POST', body: form })
        const result = await readApiJson(response)
        if (response.status === 409 && result.mergeAvailable) {
          if (confirm(`“${result.duplicate.title}” đã có. Gửi tệp này làm đề xuất bản tốt hơn cho người đăng sách?`)) {
            const proposal = new FormData(); proposal.append('file', file); if (cover) proposal.append('cover', cover, 'cover.' + (cover.type.includes('png') ? 'png' : 'jpg')); proposal.append('rights', String(rights)); proposal.append('note', 'Đề xuất bản chất lượng tốt hơn')
            const sent = await fetch(`/api/books/${result.duplicate.id}/proposals`, { method: 'POST', body: proposal })
            const message = await readApiJson(sent)
            setToast(sent.ok ? 'Đã gửi đề xuất hợp nhất cho người đăng sách.' : message.error || 'Không gửi được đề xuất.')
          }
          setUploadOpen(false); setVisibility('private'); setRights(false); setUploadQuote(''); setUploadGenre(''); setUploadTags(''); continue
        }
        if (!response.ok) throw new Error(result.error || 'Không tải được sách lên máy chủ.')
        await putFile(result.book.id, buffer)
        localStorage.setItem(`tc-file-hash:${result.book.id}`, result.book.sha256)
        if (cover) await putFile(`${result.book.id}:cover`, cover)
        if (normalized) await putFile(`${result.book.id}:reflow:v2`, await normalized.arrayBuffer())
        setServerBooks(current => [result.book, ...current])
        setToast(`Đã thêm “${title}” vào tủ sách`); setUploadOpen(false); setVisibility('private'); setRights(false); setUploadQuote(''); setUploadGenre(''); setUploadTags('')
      } catch (error) { console.error(error); setToast(error.message || `Không thể đọc “${file.name}”.`) }
    }
  }

  async function removeBook(book) {
    if (!book.mine || !confirm(`Xóa “${book.title}” cùng bình luận và dữ liệu liên quan?`)) return
    if (!book.localOnly) {
      const response = await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
      if (!response.ok) { setToast((await readApiJson(response)).error || 'Không xóa được sách.'); return }
      setServerBooks(v => v.filter(b => b.id !== book.id))
    }
    await deleteFile(book.id); await deleteFile(`${book.id}:cover`)
    localStorage.removeItem(`tc-file-hash:${book.id}`)
    setUploaded(v => v.filter(b => b.id !== book.id))
    setProgress(v => { const next = { ...v }; delete next[book.id]; return next })
    setAnnotations(v => { const next = { ...v }; delete next[book.id]; return next })
    setToast('Đã xóa sách')
  }

  async function saveBackup() {
    try {
      const blob = await exportBackup(user, books, progress, annotations, prefs)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `thu-cac-${user}-${new Date().toISOString().slice(0,10)}.zip`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      setToast('Đã tạo bản sao lưu thư viện')
    } catch (e) { console.error(e); setToast('Không thể tạo bản sao lưu trên thiết bị này.') }
  }

  async function restoreBackup(file) {
    try {
      const data = await importBackup(file)
      setUploaded(v => [...v, ...data.books])
      setProgress(v => ({ ...v, ...data.progress }))
      setAnnotations(v => ({ ...v, ...data.annotations }))
      setToast(`Đã khôi phục ${data.books.length} cuốn sách`)
    } catch (e) { console.error(e); setToast(e.message || 'Không thể mở bản sao lưu.') }
  }

  async function updateBook(updated) {
    if (updated.localOnly) setUploaded(items => items.map(b => b.id === updated.id ? { ...b, ...updated } : b))
    else {
      if (updated.mine) {
        const response = await fetch(`/api/books/${updated.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        if (!response.ok) { setToast('Không lưu được thông tin sách trên máy chủ.'); return }
      }
      setServerBooks(items => items.map(b => b.id === updated.id ? { ...b, ...updated } : b)); setDirtyId(updated.id)
    }
  }

  function updateProgress(id, value) { setProgress(v => ({ ...v, [id]: { ...(v[id] || {}), ...value } })); setDirtyId(id) }
  function updateAnnotations(id, value) { setAnnotations(v => ({ ...v, [id]: value })); setDirtyId(id) }
  async function refreshServerBooks() {
    const response = await fetch('/api/books')
    const data = await readApiJson(response)
    setServerBooks(current => data.books.map(b => ({ ...b, rating: current.find(x => x.id === b.id)?.rating || 0, quote: current.find(x => x.id === b.id)?.quote || b.quote || '' })))
  }

  function openBook(book, cfi) {
    setDetail(null); paperSound(); setActive(cfi ? { ...book, initialCfi: cfi } : book)
  }

  function nav(name) { setView(name); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="app-shell upgraded-shell">
    <aside className={`sidebar ${mobileNav ? 'show' : ''}`}><div className="brand"><div className="brand-mark"><BookOpen size={23}/></div><div><strong>Thư Các</strong><span>THE READING ROOM</span></div></div><div className="sidebar-label">KHÔNG GIAN CỦA BẠN</div><nav className="main-nav"><button className={view === 'library' ? 'active' : ''} onClick={() => nav('library')}><LibraryBig size={19}/> Tủ sách <span>{personalBooks.length}</span></button><button className={view === 'ai' ? 'active' : ''} onClick={() => nav('ai')}><Sparkles size={19}/> Bàn luận với AI</button><button className={view === 'feed' ? 'active' : ''} onClick={() => nav('feed')}><Users size={19}/> Bảng tin</button><button className={view === 'forum' ? 'active' : ''} onClick={() => nav('forum')}><MessageCircle size={19}/> Diễn đàn</button><button className={view === 'pages' ? 'active' : ''} onClick={() => nav('pages')}><BookOpen size={19}/> Fanpage</button><button className={view === 'discussion' ? 'active' : ''} onClick={() => nav('discussion')}><MessageCircle size={19}/> Tranh luận sách</button></nav><div className="sidebar-rule"/><div className="sidebar-label">CÂU CHỮ ĐÁNG NHỚ</div><div className="sidebar-quote"><span>“</span><p>{books.find(b => b.quote)?.quote || 'Một cuốn sách hay là một cuộc trò chuyện không bao giờ kết thúc.'}</p><div>— {books.find(b => b.quote)?.title || 'THƯ CÁC'}</div></div><div className="sidebar-bottom"><button onClick={onLogout}><LogOut size={16}/> Rời hồ sơ · {user}</button></div></aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={22}/></button><div className="breadcrumb">Không gian đọc <ChevronRight size={14}/> <b>{{library:'Tủ sách của tôi',ai:'Bàn luận với AI',feed:'Bảng tin',forum:'Diễn đàn',pages:'Fanpage',discussion:'Tranh luận sách'}[view]}</b></div><div className="top-actions"><div className="today-pill"><span className="sun-dot"/> MỘT NGÀY ĐẸP ĐỂ ĐỌC SÁCH</div><button className="avatar" title={`Hồ sơ ${user}`} onClick={onLogout}>{user[0].toUpperCase()}</button></div></header>
      {offline && <div className="local-banner"><strong>Chế độ thiết bị</strong><span>Sách và hồ sơ chỉ lưu trên trình duyệt này. Hãy sao lưu thường xuyên; bài viết và fanpage chỉ hiện trên thiết bị này khi chưa có máy chủ.</span></div>}
      <div className="content">{view === 'library' ? <><LibraryIntro user={user} books={personalBooks} recent={recent} progress={progress} query={query} setQuery={setQuery} onRead={openBook} onUpload={() => setUploadOpen(true)} nav={nav}/><Discovery books={books} progress={progress} onRead={openBook} onGenre={genre => { setGenreFilter(genre); document.querySelector('.library-section')?.scrollIntoView({ behavior: 'smooth' }) }}/><section className="library-section"><div className="section-heading"><div><div className="eyebrow small">BỘ SƯU TẬP CỦA BẠN</div><h2>Tủ sách của tôi <span>({personalBooks.length})</span></h2></div><button className="outline-btn" onClick={() => setUploadOpen(true)}><Plus size={17}/> Thêm EPUB / PDF</button></div><div className="library-toolbar"><div className="tabs"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>Tất cả <span>{personalBooks.length}</span></button><button className={tab === 'reading' ? 'selected' : ''} onClick={() => setTab('reading')}>Đang đọc</button><button className={tab === 'saved' ? 'selected' : ''} onClick={() => setTab('saved')}>Đã đánh dấu</button></div><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, tác giả, trích dẫn..." aria-label="Tìm sách"/></div></div><div className="hub-filters"><select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)} aria-label="Lọc thể loại"><option value="">Mọi thể loại</option>{[...new Set(personalBooks.map(b=>b.genre).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} aria-label="Lọc thẻ"><option value="">Mọi thẻ</option>{[...new Set(personalBooks.flatMap(b=>b.tags||[]))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={uploaderFilter} onChange={e=>setUploaderFilter(e.target.value)} aria-label="Lọc người đóng góp"><option value="">Mọi người đóng góp</option>{[...new Set(personalBooks.map(b=>b.uploader).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Sắp xếp sách"><option value="new">Mới tải lên</option><option value="hot">Thảo luận nhiều</option></select></div><div className="shelf-stage"><div className="shelf-back"><div className="books-grid">{filtered.map((book,index) => <div className="shelf-item" key={book.id} style={{'--i':index}}><button className="cover-button" onClick={() => openBook(book)} aria-label={`Đọc ${book.title}`}><Cover book={book}/></button><div className="book-meta"><div><h3>{book.title}</h3><p>{book.author}</p><small className="card-uploader">{book.visibility === 'public' ? `✦ Đóng góp bởi ${book.uploader}` : '🔒 Riêng tư'}{book.commentCount ? ` · ${book.commentCount} thảo luận` : ''}</small></div><button className="book-detail-button" onClick={() => setDetail(book)} aria-label={`Chi tiết ${book.title}`}>•••</button></div>{book.rating > 0 && <div className="card-rating">{'★'.repeat(book.rating)}{'☆'.repeat(5-book.rating)}</div>}{book.quote && <p className="card-quote">“{book.quote}”</p>}<div className="book-progress"><div style={{width:`${progress[book.id]?.percent || 0}%`}}/></div><small>{progress[book.id]?.percent ? `Đã đọc ${progress[book.id].percent}%` : 'Chưa bắt đầu'}</small></div>)}{personalBooks.length ? <div className="shelf-art-card"><div className="shelf-art-quote">“Tri thức là ánh sáng,<br/>đọc sách là cách để giữ<br/>ánh sáng ấy mãi trong tim.”<span>— THƯ CÁC —</span></div></div> : <button className="add-book-card" onClick={() => setUploadOpen(true)}><div className="add-icon"><Plus size={27}/></div><strong>Thêm một câu chuyện</strong><span>EPUB hoặc PDF của bạn</span></button>}</div></div><div className="shelf-board"/></div>{filtered.length === 0 && personalBooks.length > 0 && <div className="empty-state">Không tìm thấy sách. <button onClick={() => {setQuery('');setTab('all')}}>Xem tất cả</button></div>}</section><section className="quick-section"><button onClick={() => nav('ai')}><Sparkles size={21}/><span><strong>Bàn luận với AI</strong><small>Mang câu hỏi từ sách sang ChatGPT, Gemini, Claude</small></span><ArrowRight size={17}/></button><button onClick={() => nav('feed')}><MessageCircle size={21}/><span><strong>Bảng tin đọc sách</strong><small>Chia sẻ ý tưởng và gặp gỡ độc giả</small></span><ArrowRight size={17}/></button><button onClick={saveBackup}><FileText size={21}/><span><strong>Sao lưu thư viện</strong><small>Tải sách và ghi chú về thiết bị</small></span><ArrowRight size={17}/></button><button onClick={() => backupInput.current?.click()}><CloudUpload size={21}/><span><strong>Khôi phục dữ liệu</strong><small>Nhập tệp sao lưu .zip</small></span><ArrowRight size={17}/></button><input ref={backupInput} type="file" accept=".zip,application/zip" hidden onChange={e => { if(e.target.files[0]) restoreBackup(e.target.files[0]); e.target.value = '' }}/></section></> : view === 'ai' ? <AiHub books={books} annotations={annotations} toast={setToast} onRead={openBook}/> : <Community mode={view === 'discussion' ? 'debate' : view} user={user} books={books} offline={offline} onOpenBook={openBook} toast={setToast} onNavigate={target => nav(target === 'debate' ? 'discussion' : target)}/>}<footer className="site-footer">❧ &nbsp; THƯ CÁC · ĐỌC VÀ NGHĨ MỖI NGÀY &nbsp; ❧</footer></div></main>
    <MusicDock/>
    {uploadOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setUploadOpen(false) }}><div className="upload-modal"><button className="modal-close icon-button" onClick={() => setUploadOpen(false)} aria-label="Đóng"><X size={20}/></button><div className="modal-emblem"><CloudUpload size={28}/></div><div className="eyebrow small">MỞ THÊM MỘT THẾ GIỚI</div><h2>Đưa sách lên kệ</h2><p>Tải EPUB hoặc PDF. {offline ? 'Sách được lưu trên thiết bị này. Bìa thật sẽ được lấy từ tệp khi có.' : 'Chọn giữ riêng hoặc chia sẻ với cộng đồng. Bìa thật sẽ được lấy từ tệp khi có.'}</p><div className="upload-options"><div className="visibility-options"><button type="button" className={visibility === 'private' ? 'chosen' : ''} onClick={() => setVisibility('private')}>🔒 Riêng tư</button><button type="button" className={visibility === 'public' ? 'chosen' : ''} disabled={offline} title={offline ? 'Cần máy chủ cộng đồng để chia sẻ sách' : undefined} onClick={() => setVisibility('public')}>✦ Công khai</button></div><input value={uploadGenre} onChange={e => setUploadGenre(e.target.value)} placeholder="Thể loại (tùy chọn)"/><input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="Thẻ tìm kiếm, cách nhau bằng dấu phẩy"/><textarea value={uploadQuote} onChange={e => setUploadQuote(e.target.value)} rows="2" placeholder="Câu trích dẫn đại diện cho cuốn sách (tùy chọn)"/>{visibility === 'public' && <label className="rights-check"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)}/> Tôi có quyền chia sẻ tệp này với cộng đồng.</label>}</div><div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); importFiles(e.dataTransfer.files) }} onClick={() => fileInput.current?.click()}><BookOpen size={29}/><strong>Kéo thả EPUB hoặc PDF</strong><span>hoặc nhấn để chọn từ thiết bị</span><input ref={fileInput} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden onChange={e => { importFiles(e.target.files); e.target.value = '' }}/></div><small>Hỗ trợ nhiều tệp · PDF có thể xuất thành EPUB nếu có lớp chữ</small></div></div>}
    {detail && <BookDetail book={{...detail,coverUrl:detail.coverUrl || covers[detail.id]}} onClose={() => setDetail(null)} onRead={openBook} onDelete={removeBook} onUpdate={updateBook} onMerged={refreshServerBooks} toast={setToast}/>}
    {quoteDraft && <QuoteStudio book={quoteDraft.book} quote={quoteDraft.text} user={user} offline={offline} toast={setToast} onClose={() => setQuoteDraft(null)} onPosted={() => { setQuoteDraft(null); setActive(null); nav('feed') }}/>}
    {active && <FlipbookReader key={active.id} bookInfo={active} prefs={prefs} setPrefs={setPrefs} progress={progress[active.id]} setProgress={value => updateProgress(active.id, value)} annotations={annotations[active.id] || []} setAnnotations={value => updateAnnotations(active.id, value)} onClose={() => setActive(null)} onQuote={text => setQuoteDraft({ text, book: active })} toast={setToast}/>}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    fetch('/api/me')
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok) throw new Error(data.error || 'Máy chủ đọc sách chưa sẵn sàng.')
        setUser(data.user?.username || null)
      })
      .catch(error => {
        console.warn('Không kết nối được API; chuyển sang chế độ thiết bị.', error)
        setOffline(true)
        setUser(localSession())
      })
      .finally(() => setChecking(false))
  }, [])
  if (checking) return <div className="boot-screen"><BookOpen size={35}/><span>Đang mở Thư Các...</span></div>
  return user ? <AppContent key={user} user={user} offline={offline} onLogout={async () => { if (!confirm('Rời hồ sơ này? Nếu dùng hồ sơ khách trên máy chủ, bạn không thể vào lại sau khi rời vì không có mật khẩu. Hãy sao lưu sách trước.')) return; if (offline) clearLocalSession(); else await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null) }}/> : <Auth offline={offline} onLogin={setUser}/>
}

createRoot(document.getElementById('root')).render(<App />)
