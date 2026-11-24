import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bookmark, BookOpen, Flag, Heart, MessageCircle, Plus, Search, Send, Trash2, Users } from 'lucide-react'
import { readApiJson } from './api'
import { localCommunity } from './local-community'
import SocialHub from './SocialHub'
import './community.css'

const sections = [{ id: 'feed', title: 'Bảng tin' }, { id: 'forum', title: 'Diễn đàn' }, { id: 'pages', title: 'Fanpage' }, { id: 'debate', title: 'Tranh luận sách' }]

export default function Community({ mode, user, books, offline, onOpenBook, toast, onNavigate }) {
  const [data, setData] = useState({ pages: [], posts: [] })
  const [body, setBody] = useState('')
  const [bookId, setBookId] = useState('')
  const [pageId, setPageId] = useState('')
  const [pageName, setPageName] = useState('')
  const [pageDescription, setPageDescription] = useState('')
  const [creatingPage, setCreatingPage] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyFollowed, setOnlyFollowed] = useState(false)
  const [onlySaved, setOnlySaved] = useState(false)
  const [author, setAuthor] = useState('')
  const [selectedPage, setSelectedPage] = useState('')
  const [replies, setReplies] = useState({})
  const [busy, setBusy] = useState(false)
  const publicBooks = books.filter(book => book.visibility === 'public')
  const ownPages = data.pages.filter(page => page.owner === user)

  useEffect(() => {
    let active = true
    if (offline) { setData(localCommunity(user)); return }
    fetch('/api/community').then(async response => {
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.error || 'Không tải được bảng tin.')
      if (active) setData(result)
    }).catch(error => { if (active) toast(error.message) })
    return () => { active = false }
  }, [offline, user])

  async function change(action, payload = {}) {
    if (busy) return
    setBusy(true)
    try {
      if (offline) { setData(localCommunity(user, action, payload)); return true }
      const paths = {
        page: ['/api/community/pages', 'POST'], follow: [`/api/community/pages/${payload.id}/follow`, 'POST'],
        post: ['/api/community/posts', 'POST'], reply: [`/api/community/posts/${payload.id}/replies`, 'POST'],
        like: [`/api/community/posts/${payload.id}/like`, 'POST'], save: [`/api/community/posts/${payload.id}/save`, 'POST'],
        delete: [`/api/community/posts/${payload.id}`, 'DELETE'], report: [`/api/community/posts/${payload.id}/report`, 'POST'],
      }
      const [path, method] = paths[action]
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : JSON.stringify(payload) })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.error || 'Chưa lưu được thay đổi.')
      if (action !== 'report') setData(result)
      return true
    } catch (error) { toast(error.message); return false }
    finally { setBusy(false) }
  }

  async function submitPost(event) {
    event.preventDefault()
    const content = body.trim()
    if (content.length < 3) { toast('Bài viết cần ít nhất 3 ký tự.'); return }
    const book = publicBooks.find(item => item.id === bookId)
    const ok = await change('post', { kind: mode === 'forum' ? 'forum' : 'feed', body: content, pageId: mode === 'pages' ? pageId : null, bookId: book?.id || null, bookTitle: book?.title || null })
    if (ok) { setBody(''); setBookId(''); toast('Đã đăng bài viết.') }
  }
  async function submitPage(event) {
    event.preventDefault()
    if (pageName.trim().length < 3 || pageDescription.trim().length < 10) { toast('Tên cần 3 ký tự và giới thiệu cần 10 ký tự.'); return }
    const ok = await change('page', { name: pageName.trim(), description: pageDescription.trim() })
    if (ok) { setPageName(''); setPageDescription(''); setCreatingPage(false); toast('Đã tạo fanpage.') }
  }
  async function submitReply(event, post) {
    event.preventDefault()
    const content = (replies[post.id] || '').trim()
    if (content.length < 2) return
    if (await change('reply', { id: post.id, body: content })) setReplies(value => ({ ...value, [post.id]: '' }))
  }
  const visible = useMemo(() => data.posts.filter(post => {
    if (mode === 'forum' && post.kind !== 'forum') return false
    if (mode === 'feed' && post.kind === 'forum') return false
    if (mode === 'pages' && (!post.pageId || (selectedPage && post.pageId !== selectedPage))) return false
    if (onlyFollowed && !data.pages.some(page => page.id === post.pageId && page.followed)) return false
    if (onlySaved && !post.saved) return false
    if (author && post.author !== author) return false
    return `${post.body} ${post.author} ${post.bookTitle || ''} ${post.pageName || ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))
  }), [data, mode, selectedPage, onlyFollowed, onlySaved, author, search])
  const activePage = data.pages.find(page => page.id === selectedPage)

  if (mode === 'debate') return <div className="community-wrap"><div className="community-tabs">{sections.map(section => <button key={section.id} className={mode === section.id ? 'selected' : ''} onClick={() => onNavigate(section.id)}>{section.title}</button>)}</div>{offline ? <div className="community-empty"><MessageCircle size={28}/><strong>Tranh luận theo đoạn sách cần máy chủ cộng đồng.</strong><p>Bảng tin, fanpage và diễn đàn vẫn dùng được trong chế độ thiết bị.</p></div> : <SocialHub books={books} onOpenBook={onOpenBook} toast={toast}/>}</div>
  return <section className="community-wrap"><div className="community-hero"><span>THƯ CÁC · CỘNG ĐỒNG</span><h1>{mode === 'feed' ? 'Mỗi trang sách, thêm một người bạn.' : mode === 'forum' ? 'Diễn đàn của những góc nhìn.' : 'Những cộng đồng quanh trang sách.'}</h1><p>{mode === 'feed' ? 'Chia sẻ điều đang đọc, theo dõi những trang bạn yêu thích và trò chuyện cùng độc giả khác.' : mode === 'forum' ? 'Đặt câu hỏi, trao đổi kiến thức và nối tiếp các cuộc thảo luận.' : 'Tạo fanpage theo chủ đề, xây cộng đồng và đăng bài cho người theo dõi.'}</p>{offline && <small>Chế độ thiết bị · Bài viết chỉ hiện trong trình duyệt này.</small>}</div>
    <div className="community-tabs">{sections.map(section => <button key={section.id} className={mode === section.id ? 'selected' : ''} onClick={() => onNavigate(section.id)}>{section.title}</button>)}</div>
    <div className="community-grid"><div className="community-main">
      {mode === 'pages' && <div className="community-page-list"><div className="community-title-row"><h2>Khám phá fanpage</h2><button onClick={() => setCreatingPage(value => !value)}><Plus size={16}/> Tạo fanpage</button></div>{creatingPage && <form className="community-page-form" onSubmit={submitPage}><input value={pageName} onChange={event => setPageName(event.target.value)} placeholder="Tên fanpage" maxLength={60}/><textarea value={pageDescription} onChange={event => setPageDescription(event.target.value)} placeholder="Giới thiệu chủ đề của trang..." maxLength={500} rows={3}/><button disabled={busy}>Tạo trang</button></form>}<div className="community-page-cards">{data.pages.length ? data.pages.map(page => <article className={`community-page-card ${selectedPage === page.id ? 'active' : ''}`} key={page.id}><button className="community-page-icon" onClick={() => setSelectedPage(selectedPage === page.id ? '' : page.id)} aria-label={`Xem ${page.name}`}>✦</button><div><button className="community-page-name" onClick={() => setSelectedPage(selectedPage === page.id ? '' : page.id)}>{page.name}</button><p>{page.description}</p><small>Bởi {page.owner} · {page.followers} theo dõi · {page.posts} bài</small></div><button className="community-follow" onClick={() => change('follow', { id: page.id })} disabled={busy}>{page.followed ? 'Đang theo dõi' : 'Theo dõi'}</button></article>) : <p className="community-empty">Chưa có fanpage. Hãy tạo trang đầu tiên cho chủ đề bạn yêu thích.</p>}</div>{activePage && <button className="community-clear" onClick={() => setSelectedPage('')}>Đang xem {activePage.name} · Hiện tất cả ↗</button>}</div>}
      {(mode !== 'pages' || ownPages.length > 0) && <form className="community-composer" onSubmit={submitPost}><div className="community-compose-head"><span className="community-avatar">{user[0]?.toUpperCase()}</span><strong>{user}</strong><small>{mode === 'forum' ? 'Tạo chủ đề mới' : mode === 'pages' ? 'Đăng lên fanpage của bạn' : 'Chia sẻ với cộng đồng'}</small></div><textarea value={body} onChange={event => setBody(event.target.value)} placeholder={mode === 'forum' ? 'Bạn muốn hỏi hoặc bàn luận điều gì?' : 'Cuốn sách nào đang khiến bạn suy nghĩ?'} maxLength={3000} rows={4}/><div className="community-compose-actions">{mode === 'pages' && <select value={pageId} onChange={event => setPageId(event.target.value)} required><option value="">Chọn fanpage của bạn</option>{ownPages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select>}<select value={bookId} onChange={event => setBookId(event.target.value)}><option value="">Gắn sách công khai (tùy chọn)</option>{publicBooks.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select><button className="community-publish" disabled={busy}><Send size={16}/> Đăng bài</button></div></form>}
      <div className="community-toolbar"><div className="community-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm bài viết, tác giả, sách..."/></div><button className={onlyFollowed ? 'selected' : ''} onClick={() => setOnlyFollowed(value => !value)}>Đang theo dõi</button><button className={onlySaved ? 'selected' : ''} onClick={() => setOnlySaved(value => !value)}>Đã lưu</button>{author && <button onClick={() => setAuthor('')}>Bởi {author} ×</button>}</div>
      <div className="community-posts">{visible.length ? visible.map(post => <article className="community-post" key={post.id}><div className="community-post-head"><span className="community-avatar">{post.author[0]?.toUpperCase()}</span><div><button onClick={() => setAuthor(post.author)}>{post.author}</button><small>{post.pageName ? `trong ${post.pageName} · ` : ''}{new Date(post.created).toLocaleDateString('vi-VN')} · {post.kind === 'forum' ? 'Diễn đàn' : 'Bảng tin'}</small></div>{post.author === user && <button className="community-delete" onClick={() => { if (confirm('Xóa bài viết này?')) change('delete', { id: post.id }) }} title="Xóa bài"><Trash2 size={16}/></button>}</div><p className="community-post-body">{post.body}</p>{post.bookId && <button className="community-book-link" onClick={() => { const book = books.find(item => item.id === post.bookId); if (book) onOpenBook(book); else toast('Cuốn sách này không còn trong thư viện.') }}><BookOpen size={17}/> {post.bookTitle || 'Sách liên quan'} <ArrowRight size={14}/></button>}<div className="community-post-actions"><button className={post.liked ? 'selected' : ''} onClick={() => change('like', { id: post.id })}><Heart size={16} fill={post.liked ? 'currentColor' : 'none'}/> {post.likes}</button><span><MessageCircle size={16}/> {post.replyCount}</span><button className={post.saved ? 'selected' : ''} onClick={() => change('save', { id: post.id })}><Bookmark size={16} fill={post.saved ? 'currentColor' : 'none'}/> {post.saved ? 'Đã lưu' : 'Lưu'}</button><button className="community-report" onClick={() => { const reason = prompt('Vì sao bạn báo cáo bài viết này?'); if (reason?.trim()) change('report', { id: post.id, reason: reason.trim() }).then(ok => { if (ok) toast('Đã gửi báo cáo.') }) }} aria-label="Báo cáo bài viết"><Flag size={15}/></button></div><div className="community-replies">{post.replies.map(reply => <div className="community-reply" key={reply.id}><strong>{reply.author}</strong><span>{reply.body}</span></div>)}<form onSubmit={event => submitReply(event, post)}><input value={replies[post.id] || ''} onChange={event => setReplies(value => ({ ...value, [post.id]: event.target.value }))} placeholder="Viết bình luận..." maxLength={1000}/><button disabled={busy || !(replies[post.id] || '').trim()} aria-label="Gửi bình luận"><Send size={16}/></button></form></div></article>) : <div className="community-empty"><MessageCircle size={28}/><strong>Chưa có bài viết phù hợp</strong><p>Hãy chia sẻ một câu hỏi hoặc ý tưởng đầu tiên.</p></div>}</div>
    </div><aside className="community-side"><div className="community-side-card"><Users size={23}/><h3>Góc cộng đồng</h3><p>Đọc kỹ, trao đổi văn minh và trích dẫn nguồn khi bổ sung kiến thức.</p><div><b>{data.posts.length}</b><span>bài viết</span><b>{data.pages.length}</b><span>fanpage</span></div></div><div className="community-side-card"><h3>Fanpage nổi bật</h3>{data.pages.slice(0, 5).map(page => <button key={page.id} onClick={() => { setSelectedPage(page.id); onNavigate('pages') }}><span>✦</span><strong>{page.name}</strong><small>{page.followers} theo dõi</small></button>)}{!data.pages.length && <p>Chưa có trang nào.</p>}</div></aside></div>
  </section>
}
