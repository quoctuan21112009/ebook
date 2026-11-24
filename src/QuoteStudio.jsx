import React, { useEffect, useState } from 'react'
import { Download, Send, X } from 'lucide-react'
import { renderQuoteImage } from './quote-image'
import { readApiJson } from './api'
import { localCommunity } from './local-community'
import { putFile } from './storage'
import './quote-studio.css'

export default function QuoteStudio({ book, quote, user, offline, onClose, onPosted, toast }) {
  const [caption, setCaption] = useState('')
  const [scene, setScene] = useState('mountain')
  const [preview, setPreview] = useState('')
  const [blob, setBlob] = useState(null)
  const [pages, setPages] = useState([])
  const [pageId, setPageId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (offline) { setPages(localCommunity(user).pages.filter(page => page.owner === user)); return }
    fetch('/api/community').then(readApiJson).then(data => setPages((data.pages || []).filter(page => page.owner === user))).catch(() => {})
  }, [offline, user])
  useEffect(() => {
    let current = true, url = ''
    setBlob(null); setPreview('')
    document.fonts.ready.then(() => renderQuoteImage({ quote, caption, title: book.title, author: book.author, username: user, scene })).then(result => {
      if (!current) return
      url = URL.createObjectURL(result); setBlob(result); setPreview(url)
    }).catch(() => toast('Không tạo được ảnh trích dẫn.'))
    return () => { current = false; if (url) URL.revokeObjectURL(url) }
  }, [quote, caption, book.title, book.author, user, scene])
  function download() {
    if (!preview) return
    const link = document.createElement('a'); link.href = preview; link.download = `thu-cac-trich-dan-${Date.now()}.webp`; link.click()
  }
  async function post() {
    if (!blob || busy) return
    setBusy(true)
    try {
      if (blob.size > 800 * 1024) throw new Error('Ảnh quá lớn. Hãy chọn kiểu ảnh khác.')
      const body = `${caption.trim() ? `${caption.trim()}\n\n` : ''}“${quote.trim().slice(0, 600)}”\n— ${book.title}`
      if (offline) {
        const id = crypto.randomUUID(), imageKey = `community-image:${id}`
        await putFile(imageKey, blob)
        localCommunity(user, 'post', { id, kind: 'feed', body, pageId, bookId: book.visibility === 'public' ? book.id : null, bookTitle: book.title, imageKey })
      } else {
        const form = new FormData(); form.append('kind', 'feed'); form.append('body', body); form.append('pageId', pageId)
        if (book.visibility === 'public') form.append('bookId', book.id)
        form.append('image', blob, 'trich-dan.webp')
        const response = await fetch('/api/community/posts', { method: 'POST', body: form })
        const result = await readApiJson(response)
        if (!response.ok) throw new Error(result.error || 'Không đăng được ảnh.')
      }
      toast('Đã đăng ảnh trích dẫn lên cộng đồng.'); onPosted()
    } catch (error) { toast(error.message) }
    finally { setBusy(false) }
  }
  return <div className="quote-studio-backdrop"><section className="quote-studio" aria-label="Tạo ảnh trích dẫn"><header><div><span>✦ XƯỞNG TRÍCH DẪN</span><h2>Khoe một trang sách hay</h2></div><button onClick={onClose} aria-label="Đóng"><X size={21}/></button></header><div className="quote-studio-layout"><div className="quote-studio-preview">{preview ? <img src={preview} alt="Ảnh trích dẫn để chia sẻ"/> : <div>Đang tạo ảnh...</div>}</div><div className="quote-studio-controls"><p>Ảnh xuất riêng, không kèm nền hoặc nút bấm của website. Nội dung đến từ đoạn bạn vừa chọn.</p><label>KIỂU ẢNH</label><div className="quote-scene-options">{[['mountain','Sớm mai'],['valley','Thung lũng'],['room','Thư phòng']].map(([id,name]) => <button key={id} className={scene === id ? 'selected' : ''} onClick={() => setScene(id)}>{name}</button>)}</div><label htmlFor="quote-caption">CAPTION CỦA BẠN</label><textarea id="quote-caption" value={caption} onChange={event => setCaption(event.target.value)} maxLength={120} rows={3} placeholder="Một suy nghĩ để đi cùng câu văn này..."/><label htmlFor="quote-page">ĐĂNG Ở ĐÂU</label><select id="quote-page" value={pageId} onChange={event => setPageId(event.target.value)}><option value="">Bảng tin cộng đồng</option>{pages.map(page => <option key={page.id} value={page.id}>Fanpage · {page.name}</option>)}</select><div className="quote-studio-actions"><button onClick={download} disabled={!blob}><Download size={17}/> Tải ảnh WebP</button><button onClick={post} disabled={!blob || busy}><Send size={17}/> {busy ? 'Đang đăng...' : 'Đăng ảnh'}</button></div><small>Ảnh được nén trước khi lưu; ảnh dài hiển thị tối đa 320 ký tự. Bạn có thể đăng và tải cùng một ảnh.</small></div></div></section></div>
}
