import React, { useState } from 'react'
import { BookOpen, UserRound } from 'lucide-react'
import { readApiJson } from './api'
import { localEnter } from './local-auth'

export default function Auth({ onLogin, offline = false }) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    const name = username.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 30 || !/^[\p{L}\p{N}_ .-]+$/u.test(name)) {
      setError('Tên cần 2–30 ký tự, gồm chữ, số, khoảng trắng, dấu chấm hoặc gạch nối.'); return
    }
    setBusy(true)
    try {
      if (offline) { onLogin(localEnter(name)); return }
      const response = await fetch('/api/identity/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name }) })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.error || 'Chưa thể vào thư viện.')
      onLogin(result.user.username)
    } catch (cause) { setError(cause.message || 'Không kết nối được máy chủ.') }
    finally { setBusy(false) }
  }
  return <div className="auth-page"><div className="auth-glow"/><div className="auth-left"><div className="auth-logo"><BookOpen size={27}/><span>Thư Các</span></div><div className="auth-intro"><span>KHÔNG GIAN ĐỌC CỦA RIÊNG BẠN</span><h1>Mỗi trang sách mở ra một thế giới.</h1><p>Một nơi giữ sách, ý tưởng và những câu chữ đáng nhớ.</p></div><div className="auth-art"><div className="auth-art-book one"/><div className="auth-art-book two"/><div className="auth-art-book three"/><div className="auth-art-book four"/><div className="auth-art-shelf"/></div></div><div className="auth-right"><form className="auth-form" onSubmit={submit}><div className="auth-small-logo"><BookOpen size={22}/> THƯ CÁC</div><div className="eyebrow small">CHÀO MỪNG ĐẾN VỚI THƯ VIỆN</div><h2>Chọn tên để bắt đầu đọc</h2><p>Không cần đăng ký hay mật khẩu. Tên này sẽ hiện bên cạnh bài viết và bình luận của bạn.</p><label>TÊN HIỂN THỊ<div className="auth-input"><UserRound size={18}/><input autoComplete="nickname" value={username} onChange={event => setUsername(event.target.value)} placeholder="Tên của bạn" required maxLength={30}/></div></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Đang mở...' : 'Vào Thư Các'}</button><div className="auth-note">{offline ? 'Chế độ thiết bị: sách và hoạt động chỉ lưu trong trình duyệt này. Hãy sao lưu thư viện thường xuyên.' : 'Phiên khách được giữ trên trình duyệt này. Nếu xóa dữ liệu trình duyệt, bạn sẽ mất quyền vào lại hồ sơ khách và sách riêng tư.'}</div></form></div></div>
}
