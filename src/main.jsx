import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, CloudUpload, Focus, Highlighter, LibraryBig, List, Menu, Minus, Plus, Search, Settings2, Sparkles, Star, StickyNote, Trash2, X, MessageCircle, LogOut, Music2, Quote, FileText } from 'lucide-react'
import { deleteFile, getFile, ensureFile, ensureReflow, loadJson, putFile, saveJson } from './storage'
import { extractEpubCover, pdfCover, pdfToEpub, suggestQuoteFromEpub, suggestQuoteFromPdf } from './book-utils'
import { exportBackup, importBackup } from './backup'
import { readApiJson } from './api'
import { clearLocalSession, localSession } from './local-auth'
import Auth from './Auth'
import PdfReader from './PdfReader'
import { AiHub, MusicDock } from './Extras'
import Discussion from './SocialHub'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/700.css'
import notoSerifUrl from '@fontsource/noto-serif/files/noto-serif-vietnamese-400-normal.woff2?url'
import notoSansUrl from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff2?url'
import notoSerifLatinUrl from '@fontsource/noto-serif/files/noto-serif-latin-400-normal.woff2?url'
import notoSansLatinUrl from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff2?url'
import './style.css'
import './upgrades.css'
import './social.css'
import './illustrated.css'

const defaultPrefs = { fontSize: 19, font: 'serif', theme: 'paper', lineHeight: 1.7, margin: 60 }
const themes = [ { id: 'paper', label: 'Giấy ngà', color: '#f5ecd9' }, { id: 'white', label: 'Trắng ấm', color: '#fffdfa' }, { id: 'sepia', label: 'Nâu cổ', color: '#dec7a3' }, { id: 'night', label: 'Đêm', color: '#232927' } ]

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

function ThreadList({ comments, filter, setFilter, onVote, onJump }) {
  const visible = comments.filter(c => filter === 'Tất cả' || c.tag === filter)
  return <div className="thread-list"><div className="thread-filters">{['Tất cả','Bổ sung kiến thức','Phản biện','Cảm nhận'].map(tag => <button key={tag} className={filter === tag ? 'active' : ''} onClick={() => setFilter(tag)}>{tag}</button>)}</div>{visible.length ? visible.map(c => <article className={`thread-card ${c.collapsed ? 'collapsed' : ''}`} key={c.id}><div className="thread-head"><strong>{c.username}</strong><span>{c.tag}</span></div><button className="thread-quote" onClick={() => onJump(c.cfi)}>“{c.quote}”</button>{c.collapsed ? <details><summary>Ẩn do điểm thấp. Xem nội dung</summary><p>{c.body}</p></details> : <p>{c.body}</p>}<div className="thread-votes"><button className={c.myVote === 1 ? 'on' : ''} onClick={() => onVote(c,1)}>▲</button><b>{c.score}</b><button className={c.myVote === -1 ? 'on' : ''} onClick={() => onVote(c,-1)}>▼</button></div></article>) : <div className="panel-empty"><MessageCircle size={28}/><strong>Chưa có bình luận</strong><span>Chọn một đoạn văn để bắt đầu cuộc trò chuyện.</span></div>}</div>
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

function AppContent({ user, onLogout, offline = false }) {
  const key = field => `tc-${field}:${user}`
  const [uploaded, setUploaded] = useState(() => loadJson(key('books'), []).map(b => ({ ...b, type: b.type || 'epub' })))
  const [serverBooks, setServerBooks] = useState([])
  const [serverLoaded, setServerLoaded] = useState(false)
  const [dirtyId, setDirtyId] = useState(null)
  const [progress, setProgress] = useState(() => loadJson(key('progress'), {}))
  const [annotations, setAnnotations] = useState(() => loadJson(key('annotations'), {}))
  const [prefs, setPrefs] = useState(() => loadJson(key('prefs'), defaultPrefs))
  const [covers, setCovers] = useState({})
  const [active, setActive] = useState(null)
  const [opening, setOpening] = useState(null)
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
  const filtered = books.filter(b => (tab === 'all' || (tab === 'reading' && progress[b.id]?.updated) || (tab === 'saved' && annotations[b.id]?.some(a => a.type === 'bookmark'))) && `${b.title} ${b.author} ${b.quote || ''} ${(b.tags||[]).join(' ')}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) && (!genreFilter || b.genre === genreFilter) && (!uploaderFilter || b.uploader === uploaderFilter) && (!tagFilter || (b.tags||[]).includes(tagFilter))).sort((a,b) => sortBy === 'hot' ? (b.commentCount||0)-(a.commentCount||0) : (b.added||0)-(a.added||0))
  const recent = [...books].filter(b => progress[b.id]?.updated).sort((a,b) => progress[b.id].updated - progress[a.id].updated)[0] || books[0]

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
          if (normalized) await putFile(`${id}:reflow`, await normalized.arrayBuffer())
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
        if (normalized) await putFile(`${result.book.id}:reflow`, await normalized.arrayBuffer())
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
    setDetail(null); setOpening(book); paperSound()
    setTimeout(() => { setOpening(null); setActive(cfi ? { ...book, initialCfi: cfi } : book) }, 850)
  }

  function nav(name) { setView(name); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="app-shell upgraded-shell">
    <aside className={`sidebar ${mobileNav ? 'show' : ''}`}><div className="brand"><div className="brand-mark"><BookOpen size={23}/></div><div><strong>Thư Các</strong><span>THE READING ROOM</span></div></div><div className="sidebar-label">KHÔNG GIAN CỦA BẠN</div><nav className="main-nav"><button className={view === 'library' ? 'active' : ''} onClick={() => nav('library')}><LibraryBig size={19}/> Tủ sách <span>{books.length}</span></button><button className={view === 'ai' ? 'active' : ''} onClick={() => nav('ai')}><Sparkles size={19}/> Bàn luận với AI</button><button className={view === 'discussion' ? 'active' : ''} onClick={() => nav('discussion')}><MessageCircle size={19}/> Trang trao đổi</button></nav><div className="sidebar-rule"/><div className="sidebar-label">CÂU CHỮ ĐÁNG NHỚ</div><div className="sidebar-quote"><span>“</span><p>{books.find(b => b.quote)?.quote || 'Một cuốn sách hay là một cuộc trò chuyện không bao giờ kết thúc.'}</p><div>— {books.find(b => b.quote)?.title || 'THƯ CÁC'}</div></div><div className="sidebar-bottom"><button onClick={onLogout}><LogOut size={16}/> Đăng xuất · {user}</button></div></aside>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={22}/></button><div className="breadcrumb">Không gian đọc <ChevronRight size={14}/> <b>{{library:'Tủ sách của tôi',ai:'Bàn luận với AI',discussion:'Trang trao đổi'}[view]}</b></div><div className="top-actions"><div className="today-pill"><span className="sun-dot"/> MỘT NGÀY ĐẸP ĐỂ ĐỌC SÁCH</div><button className="avatar" title={`Hồ sơ ${user}`} onClick={onLogout}>{user[0].toUpperCase()}</button></div></header>
      {offline && <div className="local-banner"><strong>Chế độ thiết bị</strong><span>Sách và hồ sơ chỉ lưu trên trình duyệt này. Hãy sao lưu thường xuyên; thảo luận cộng đồng cần máy chủ.</span></div>}
      <div className="content">{view === 'library' ? <><LibraryIntro user={user} books={books} recent={recent} progress={progress} query={query} setQuery={setQuery} onRead={openBook} onUpload={() => setUploadOpen(true)} nav={nav}/><section className="library-section"><div className="section-heading"><div><div className="eyebrow small">BỘ SƯU TẬP CỦA BẠN</div><h2>Tủ sách của tôi <span>({books.length})</span></h2></div><button className="outline-btn" onClick={() => setUploadOpen(true)}><Plus size={17}/> Thêm EPUB / PDF</button></div><div className="library-toolbar"><div className="tabs"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>Tất cả <span>{books.length}</span></button><button className={tab === 'reading' ? 'selected' : ''} onClick={() => setTab('reading')}>Đang đọc</button><button className={tab === 'saved' ? 'selected' : ''} onClick={() => setTab('saved')}>Đã đánh dấu</button></div><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, tác giả, trích dẫn..." aria-label="Tìm sách"/></div></div><div className="hub-filters"><select value={genreFilter} onChange={e=>setGenreFilter(e.target.value)} aria-label="Lọc thể loại"><option value="">Mọi thể loại</option>{[...new Set(books.map(b=>b.genre).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} aria-label="Lọc thẻ"><option value="">Mọi thẻ</option>{[...new Set(books.flatMap(b=>b.tags||[]))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={uploaderFilter} onChange={e=>setUploaderFilter(e.target.value)} aria-label="Lọc người đóng góp"><option value="">Mọi người đóng góp</option>{[...new Set(books.map(b=>b.uploader).filter(Boolean))].map(x=><option key={x} value={x}>{x}</option>)}</select><select value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Sắp xếp sách"><option value="new">Mới tải lên</option><option value="hot">Thảo luận nhiều</option></select></div><div className="shelf-stage"><div className="shelf-back"><div className="books-grid">{filtered.map((book,index) => <div className="shelf-item" key={book.id} style={{'--i':index}}><button className="cover-button" onClick={() => openBook(book)} aria-label={`Đọc ${book.title}`}><Cover book={book}/></button><div className="book-meta"><div><h3>{book.title}</h3><p>{book.author}</p><small className="card-uploader">{book.visibility === 'public' ? `✦ Đóng góp bởi ${book.uploader}` : '🔒 Riêng tư'}{book.commentCount ? ` · ${book.commentCount} thảo luận` : ''}</small></div><button className="book-detail-button" onClick={() => setDetail(book)} aria-label={`Chi tiết ${book.title}`}>•••</button></div>{book.rating > 0 && <div className="card-rating">{'★'.repeat(book.rating)}{'☆'.repeat(5-book.rating)}</div>}{book.quote && <p className="card-quote">“{book.quote}”</p>}<div className="book-progress"><div style={{width:`${progress[book.id]?.percent || 0}%`}}/></div><small>{progress[book.id]?.percent ? `Đã đọc ${progress[book.id].percent}%` : 'Chưa bắt đầu'}</small></div>)}{books.length ? <div className="shelf-art-card"><div className="shelf-art-quote">“Tri thức là ánh sáng,<br/>đọc sách là cách để giữ<br/>ánh sáng ấy mãi trong tim.”<span>— THƯ CÁC —</span></div></div> : <button className="add-book-card" onClick={() => setUploadOpen(true)}><div className="add-icon"><Plus size={27}/></div><strong>Thêm một câu chuyện</strong><span>EPUB hoặc PDF của bạn</span></button>}</div></div><div className="shelf-board"/></div>{filtered.length === 0 && books.length > 0 && <div className="empty-state">Không tìm thấy sách. <button onClick={() => {setQuery('');setTab('all')}}>Xem tất cả</button></div>}</section><section className="quick-section"><button onClick={() => nav('ai')}><Sparkles size={21}/><span><strong>Bàn luận với AI</strong><small>Mang câu hỏi từ sách sang ChatGPT, Gemini, Claude</small></span><ArrowRight size={17}/></button><button onClick={() => nav('discussion')}><MessageCircle size={21}/><span><strong>Nhật ký trao đổi</strong><small>Ghi lại suy nghĩ sau mỗi trang sách</small></span><ArrowRight size={17}/></button><button onClick={saveBackup}><FileText size={21}/><span><strong>Sao lưu thư viện</strong><small>Tải sách và ghi chú về thiết bị</small></span><ArrowRight size={17}/></button><button onClick={() => backupInput.current?.click()}><CloudUpload size={21}/><span><strong>Khôi phục dữ liệu</strong><small>Nhập tệp sao lưu .zip</small></span><ArrowRight size={17}/></button><input ref={backupInput} type="file" accept=".zip,application/zip" hidden onChange={e => { if(e.target.files[0]) restoreBackup(e.target.files[0]); e.target.value = '' }}/></section></> : view === 'ai' ? <AiHub books={books} annotations={annotations} toast={setToast}/> : offline ? <div className="offline-community"><MessageCircle size={32}/><h1>Thảo luận cộng đồng chưa kết nối</h1><p>Bạn vẫn có thể đọc, đánh dấu và ghi chú trên thiết bị này. Trang trao đổi sẽ hoạt động khi máy chủ cộng đồng được triển khai.</p></div> : <Discussion books={books} onOpenBook={openBook} toast={setToast}/>}<footer className="site-footer">❧ &nbsp; THƯ CÁC · ĐỌC VÀ NGHĨ MỖI NGÀY &nbsp; ❧</footer></div></main>
    <MusicDock/>
    {uploadOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setUploadOpen(false) }}><div className="upload-modal"><button className="modal-close icon-button" onClick={() => setUploadOpen(false)} aria-label="Đóng"><X size={20}/></button><div className="modal-emblem"><CloudUpload size={28}/></div><div className="eyebrow small">MỞ THÊM MỘT THẾ GIỚI</div><h2>Đưa sách lên kệ</h2><p>Tải EPUB hoặc PDF. {offline ? 'Sách được lưu trên thiết bị này. Bìa thật sẽ được lấy từ tệp khi có.' : 'Chọn giữ riêng hoặc chia sẻ với cộng đồng. Bìa thật sẽ được lấy từ tệp khi có.'}</p><div className="upload-options"><div className="visibility-options"><button type="button" className={visibility === 'private' ? 'chosen' : ''} onClick={() => setVisibility('private')}>🔒 Riêng tư</button><button type="button" className={visibility === 'public' ? 'chosen' : ''} disabled={offline} title={offline ? 'Cần máy chủ cộng đồng để chia sẻ sách' : undefined} onClick={() => setVisibility('public')}>✦ Công khai</button></div><input value={uploadGenre} onChange={e => setUploadGenre(e.target.value)} placeholder="Thể loại (tùy chọn)"/><input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="Thẻ tìm kiếm, cách nhau bằng dấu phẩy"/><textarea value={uploadQuote} onChange={e => setUploadQuote(e.target.value)} rows="2" placeholder="Câu trích dẫn đại diện cho cuốn sách (tùy chọn)"/>{visibility === 'public' && <label className="rights-check"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)}/> Tôi có quyền chia sẻ tệp này với cộng đồng.</label>}</div><div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); importFiles(e.dataTransfer.files) }} onClick={() => fileInput.current?.click()}><BookOpen size={29}/><strong>Kéo thả EPUB hoặc PDF</strong><span>hoặc nhấn để chọn từ thiết bị</span><input ref={fileInput} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden onChange={e => { importFiles(e.target.files); e.target.value = '' }}/></div><small>Hỗ trợ nhiều tệp · PDF có thể xuất thành EPUB nếu có lớp chữ</small></div></div>}
    {detail && <BookDetail book={{...detail,coverUrl:detail.coverUrl || covers[detail.id]}} onClose={() => setDetail(null)} onRead={openBook} onDelete={removeBook} onUpdate={updateBook} onMerged={refreshServerBooks} toast={setToast}/>}
    {opening && <div className="opening-scene"><div className="opening-book"><Cover book={opening} size="hero"/><div className="opening-page"/></div><span>Đang mở “{opening.title}”</span></div>}
    {active && (active.type === 'pdf' ? <PdfReader key={active.id} bookInfo={active} onClose={() => setActive(null)} onReflow={() => setActive({ ...active, type: 'epub', reflow: true })} progress={progress[active.id]} setProgress={value => updateProgress(active.id, value)} toast={setToast}/> : <Reader key={active.id} bookInfo={active} onClose={() => setActive(null)} prefs={prefs} setPrefs={setPrefs} progress={progress[active.id]} setProgress={value => updateProgress(active.id, value)} annotations={annotations[active.id] || []} setAnnotations={value => updateAnnotations(active.id, value)} toast={setToast}/>)}
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
  return user ? <AppContent key={user} user={user} offline={offline} onLogout={async () => { if (offline) clearLocalSession(); else await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null) }}/> : <Auth offline={offline} onLogin={setUser}/>
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
  const [social, setSocial] = useState(false)
  const [comments, setComments] = useState([])
  const [commentTag, setCommentTag] = useState('Cảm nhận')
  const [commentBody, setCommentBody] = useState('')
  const [commentFilter, setCommentFilter] = useState('Tất cả')
  const [minutes, setMinutes] = useState(25)
  const [running, setRunning] = useState(false)
  const [flip, setFlip] = useState('')
  const locationRef = useRef(bookInfo.initialCfi || progress?.cfi)
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
    if (bookInfo.visibility !== 'public') return
    fetch(`/api/comments?bookId=${bookInfo.id}`).then(r=>readApiJson(r)).then(data=>setComments(data.comments||[])).catch(()=>{})
  }, [bookInfo.id, bookInfo.visibility])

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
        const data = bookInfo.reflow ? await ensureReflow(bookInfo.id) : await ensureFile(bookInfo.id, bookInfo.sha256)
        if (!data) throw new Error('Không tìm thấy tệp sách trên thiết bị này')
        if (cancelled) return
        const { default: ePub } = await import('epubjs')
        localBook = ePub(data)
        epubBook.current = localBook
        await localBook.ready
        if (cancelled) return
        const navigation = await localBook.loaded.navigation
        setToc(navigation.toc || [])
        const r = localBook.renderTo(viewer.current, { width: '100%', height: '100%', flow: 'paginated', spread: 'auto', minSpreadWidth: 800, allowScriptedContent: false })
        rendition.current = r
        r.on('rendered', (_, view) => {
          const style = view.contents.document.createElement('style')
          const vietnamese = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
          const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
          style.textContent = `@font-face{font-family:"Thu Cac Serif";src:url("${notoSerifUrl}") format("woff2");font-weight:400;unicode-range:${vietnamese}}@font-face{font-family:"Thu Cac Serif";src:url("${notoSerifLatinUrl}") format("woff2");font-weight:400;unicode-range:${latin}}@font-face{font-family:"Thu Cac Sans";src:url("${notoSansUrl}") format("woff2");font-weight:400;unicode-range:${vietnamese}}@font-face{font-family:"Thu Cac Sans";src:url("${notoSansLatinUrl}") format("woff2");font-weight:400;unicode-range:${latin}}`
          view.contents.document.head.appendChild(style)
        })
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
        localBook.locations.generate(900).then(() => { if (!cancelled && locationRef.current) { const p = Math.round(localBook.locations.percentageFromCfi(locationRef.current) * 100); if (Number.isFinite(p)) { setPercent(p); setProgress({ cfi: locationRef.current, percent: p, updated: Date.now() }) } } }).catch(() => {})
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
    const readableFont = prefs.font === 'serif' ? '"Thu Cac Serif", "DejaVu Serif", serif' : '"Thu Cac Sans", "DejaVu Sans", sans-serif'
    r.themes.default({ body: { color: `${fg} !important`, background: `${bg} !important`, 'font-family': `${readableFont} !important`, 'font-size': `${prefs.fontSize}px !important`, 'line-height': `${prefs.lineHeight} !important`, 'padding-left': `${prefs.margin / 3}px !important`, 'padding-right': `${prefs.margin / 3}px !important` }, 'body *': { 'font-family': `${readableFont} !important`, 'letter-spacing': 'normal !important', 'word-spacing': 'normal !important', 'font-kerning': 'normal !important' }, p: { color: `${fg} !important`, 'font-weight': '400 !important', 'font-size': `${prefs.fontSize}px !important`, 'line-height': `${prefs.lineHeight} !important`, 'text-align': 'left !important', hyphens: 'none !important' }, a: { color: '#a06b40 !important' } })
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
    paperSound()
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
  async function addComment() {
    if (!selection || !commentBody.trim()) { toast('Hãy viết bình luận cho đoạn đã chọn.'); return }
    const response = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: bookInfo.id, cfi: selection.cfi, quote: selection.text, body: commentBody, tag: commentTag }) })
    const result = await readApiJson(response)
    if (!response.ok) { toast(result.error || 'Không đăng được bình luận.'); return }
    setComments(v => [result.comment, ...v]); setCommentBody(''); setSelection(null); setPanel('social'); toast('Đã đăng bình luận theo đoạn văn')
  }
  async function voteComment(comment, value) {
    const response = await fetch(`/api/comments/${comment.id}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: comment.myVote === value ? 0 : value }) })
    const result = await readApiJson(response)
    if (!response.ok) { toast(result.error || 'Không thể bình chọn.'); return }
    setComments(v => v.map(c => c.id === comment.id ? result.comment : c))
  }
  function removeAnnotation(id) { setAnnotations(annotations.filter(a => a.id !== id)); toast('Đã xóa ghi chú') }
  function goTo(cfi) { rendition.current?.display(cfi); setPanel('') }
  function changePref(key, value) { setPrefs(p => ({ ...p, [key]: value })) }

  return <div className={`reader ${focus ? 'focus-mode' : ''} theme-${prefs.theme}`}>
    <header className="reader-header"><div className="reader-header-left"><button className="reader-icon" onClick={onClose} aria-label="Về tủ sách"><ArrowLeft size={20}/></button><div className="reader-divider"/><div className="reader-book-title"><strong>{bookInfo.title}</strong><span>{bookInfo.author}</span></div></div><div className="reader-center"><span className="reader-dot"/> {chapter || 'Không gian đọc'}</div><div className="reader-actions"><button className={`reader-icon ${panel === 'toc' ? 'on' : ''}`} onClick={() => setPanel(panel === 'toc' ? '' : 'toc')} title="Mục lục" aria-label="Mục lục"><List size={20}/></button><button className="reader-icon" onClick={addBookmark} title="Đánh dấu trang" aria-label="Đánh dấu trang"><Bookmark size={19}/></button><button className={`reader-icon ${panel === 'notes' ? 'on' : ''}`} onClick={() => setPanel(panel === 'notes' ? '' : 'notes')} title="Ghi chú" aria-label="Ghi chú"><StickyNote size={19}/></button><button className={`reader-icon ${panel === 'settings' ? 'on' : ''}`} onClick={() => setPanel(panel === 'settings' ? '' : 'settings')} title="Tùy chỉnh đọc" aria-label="Tùy chỉnh đọc"><Settings2 size={20}/></button><button className={`reader-icon social-switch ${social ? 'on' : ''}`} onClick={() => { if (bookInfo.visibility !== 'public') { toast('Chế độ cộng đồng chỉ có ở sách công khai.'); return } setSocial(!social); setFocus(false); setPanel(!social ? 'social' : '') }} title="Chế độ Social" aria-label="Chế độ Social"><MessageCircle size={19}/></button><div className="reader-divider"/><button className={`reader-icon ${focus ? 'on' : ''}`} onClick={() => { setFocus(!focus); setSocial(false); setPanel('') }} title="Chế độ tập trung" aria-label="Chế độ tập trung"><Focus size={20}/></button></div></header>
    {focus && <button className="zen-exit" onClick={() => setFocus(false)} aria-label="Thoát chế độ Zen"><X size={20}/> Thoát Zen</button>}
    <div className="reader-body"><div className="reader-ambient"/><button className="page-arrow left" onClick={() => page('prev')} aria-label="Trang trước"><ChevronLeft size={26}/></button><div className={`paper-book flip-${flip}`}><div className="paper-spine"/><div className="epub-view" ref={viewer}/>{loading && <div className="reader-loading"><BookOpen size={36}/><p>Đang mở những trang sách...</p></div>}{error && <div className="reader-loading error"><BookOpen size={36}/><p>{error}</p><button onClick={onClose}>Trở về tủ sách</button></div>}</div><button className="page-arrow right" onClick={() => page('next')} aria-label="Trang tiếp"><ChevronRight size={26}/></button>{social && <div className="social-heatmap" aria-label="Bản đồ bình luận">{comments.filter(c => c.cfi).slice(0,25).map((c,i) => { let position = (i+1)/(comments.length+1)*100; try { if(epubBook.current?.locations?.length()) position = epubBook.current.locations.percentageFromCfi(c.cfi)*100 } catch {} return <button key={c.id} style={{top:`${Math.max(5,Math.min(95,position))}%`,opacity:Math.max(.45,Math.min(1,.5+c.score*.08))}} onClick={() => {goTo(c.cfi);setPanel('social')}} title={`${c.tag}: ${c.quote.slice(0,60)}`} /> })}</div>}</div>
    <footer className="reader-footer"><button onClick={() => setPanel('toc')}><List size={15}/> Mục lục</button><div className="reading-progress"><span>{percent}%</span><div className="progress-track"><div style={{ width: `${percent}%` }}/></div><span>Hoàn thành</span></div><div className="footer-right"><button onClick={() => setPanel(panel === 'timer' ? '' : 'timer')}><Clock3 size={15}/> {running ? `${String(Math.floor(minutes)).padStart(2,'0')}:${String(Math.floor((minutes % 1) * 60)).padStart(2,'0')}` : 'Tập trung'}</button><span className="footer-hint">← → để lật trang</span></div></footer>
    {panel && <><div className="reader-panel-scrim" onClick={() => { setPanel(''); setSelection(null) }}/><aside className="reader-panel"><div className="panel-head"><div><span className="eyebrow small">THƯ CÁC</span><h2>{{ toc: 'Mục lục', notes: 'Sổ tay đọc sách', settings: 'Tùy chỉnh đọc', selection: 'Lưu điều hay', social: 'Bình luận theo đoạn', timer: 'Thời gian tập trung' }[panel]}</h2></div><button className="reader-icon" onClick={() => { setPanel(''); setSelection(null) }} aria-label="Đóng"><X size={20}/></button></div>
      {panel === 'toc' && <div className="panel-scroll"><p className="panel-intro">Chọn một chương để bắt đầu đọc.</p>{toc.map((item, i) => <button className="toc-item" key={`${item.href}-${i}`} onClick={() => goTo(item.href)}><span>{String(i+1).padStart(2,'0')}</span>{item.label?.trim()}<ChevronRight size={16}/></button>)}</div>}
      {panel === 'notes' && <div className="panel-scroll"><p className="panel-intro">Những ý tưởng bạn muốn giữ lại, ngay cạnh trang sách.</p>{annotations.length ? [...annotations].reverse().map(a => <div className="annotation-card" key={a.id}><div className="annotation-type">{a.type === 'bookmark' ? <Bookmark size={14}/> : <Highlighter size={14}/>} {a.type === 'bookmark' ? 'ĐÁNH DẤU' : 'BÔI ĐẬM'}</div><button className="annotation-text" onClick={() => goTo(a.cfi)}>{a.text}</button>{a.note && <p>{a.note}</p>}<button className="annotation-delete" onClick={() => removeAnnotation(a.id)}><Trash2 size={14}/> Xóa</button></div>) : <div className="panel-empty"><StickyNote size={29}/><strong>Chưa có ghi chú nào</strong><span>Chọn một đoạn văn trong sách để bôi đậm và ghi lại suy nghĩ.</span></div>}</div>}
      {panel === 'settings' && <div className="panel-scroll settings-content"><div className="setting-group"><label>KIỂU CHỮ</label><div className="font-options"><button className={prefs.font === 'serif' ? 'chosen' : ''} onClick={() => changePref('font', 'serif')}><span className="serif-preview">Aa</span> Cổ điển</button><button className={prefs.font === 'sans' ? 'chosen' : ''} onClick={() => changePref('font', 'sans')}><span className="sans-preview">Aa</span> Hiện đại</button></div></div><div className="setting-group"><label>CỠ CHỮ <b>{prefs.fontSize}px</b></label><div className="stepper"><button onClick={() => changePref('fontSize', Math.max(12, prefs.fontSize-1))}><Minus size={17}/></button><input type="range" min="12" max="30" value={prefs.fontSize} onChange={e => changePref('fontSize', +e.target.value)}/><button onClick={() => changePref('fontSize', Math.min(30, prefs.fontSize+1))}><Plus size={17}/></button></div></div><div className="setting-group"><label>NỀN GIẤY</label><div className="theme-options">{themes.map(t => <button key={t.id} className={prefs.theme === t.id ? 'chosen' : ''} onClick={() => changePref('theme', t.id)}><span style={{ background: t.color }}>{prefs.theme === t.id && <Check size={16}/>}</span>{t.label}</button>)}</div></div><div className="setting-group"><label>GIÃN DÒNG <b>{prefs.lineHeight.toFixed(1)}</b></label><input className="full-range" type="range" min="1.3" max="2.2" step="0.1" value={prefs.lineHeight} onChange={e => changePref('lineHeight', +e.target.value)}/></div><div className="settings-foot">Tùy chỉnh được lưu tự động cho những lần đọc sau.</div></div>}
      {panel === 'social' && <div className="panel-scroll"><p className="panel-intro">Bình luận luôn gắn với đoạn chữ cụ thể. Chạm vào trích dẫn để đến vị trí đó.</p><ThreadList comments={comments} filter={commentFilter} setFilter={setCommentFilter} onVote={voteComment} onJump={goTo}/></div>}
      {panel === 'selection' && <div className="panel-scroll"><div className="quote-card">“{selection?.text}”</div><label className="note-label">GHI CHÚ CỦA BẠN</label><textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Điều gì ở đoạn này khiến bạn muốn nhớ?" rows="5"/><button className="save-note-btn" onClick={addHighlight}><Highlighter size={17}/> Lưu đoạn này</button>{social && bookInfo.visibility === 'public' && <div className="inline-compose"><label className="note-label">BÌNH LUẬN CỘNG ĐỒNG</label><div className="comment-tag-options">{['Bổ sung kiến thức','Phản biện','Cảm nhận'].map(tag => <button key={tag} className={commentTag === tag ? 'active' : ''} onClick={() => setCommentTag(tag)}>{tag}</button>)}</div><textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Viết ý kiến bám sát đoạn đã chọn..." rows="4"/><button className="save-note-btn social-submit" onClick={addComment}><MessageCircle size={17}/> Đăng bình luận</button></div>}</div>}
      {panel === 'timer' && <div className="panel-scroll timer-panel"><div className="timer-circle"><Clock3 size={27}/><strong>{String(Math.floor(minutes)).padStart(2,'0')}:{String(Math.floor((minutes % 1)*60)).padStart(2,'0')}</strong><span>PHÚT TẬP TRUNG</span></div><p>Dành trọn một khoảng thời gian cho trang sách này.</p><button className="save-note-btn" onClick={() => setRunning(!running)}>{running ? 'Tạm dừng' : 'Bắt đầu đọc'}</button><button className="timer-reset" onClick={() => { setRunning(false); setMinutes(25) }}>Đặt lại 25 phút</button></div>}
    </aside></>}
  </div>
}


createRoot(document.getElementById('root')).render(<App />)
