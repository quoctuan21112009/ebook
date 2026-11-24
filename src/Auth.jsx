import React, { useState } from 'react'
import { BookOpen, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault(); setError('')
    const name = username.trim().toLowerCase()
    if (!/^[a-z0-9_.-]{3,30}$/.test(name)) { setError('Tên đăng nhập cần 3–30 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'); return }
    if (password.length < 8) { setError('Mật khẩu cần ít nhất 8 ký tự.'); return }
    setBusy(true)
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Không thể đăng nhập.')
      onLogin(result.user.username)
    } catch (e) { setError(e.message || 'Không kết nối được máy chủ.') }
    finally { setBusy(false) }
  }

  return <div className="auth-page"><div className="auth-glow"/><div className="auth-left"><div className="auth-logo"><BookOpen size={27}/><span>Thư Các</span></div><div className="auth-intro"><span>KHÔNG GIAN ĐỌC CỦA RIÊNG BẠN</span><h1>Mỗi trang sách mở ra một thế giới.</h1><p>Một nơi giữ sách, ý tưởng và những câu chữ đáng nhớ.</p></div><div className="auth-art"><div className="auth-art-book one"/><div className="auth-art-book two"/><div className="auth-art-book three"/><div className="auth-art-book four"/><div className="auth-art-shelf"/></div></div><div className="auth-right"><form className="auth-form" onSubmit={submit}><div className="auth-small-logo"><BookOpen size={22}/> THƯ CÁC</div><div className="eyebrow small">CHÀO MỪNG ĐẾN VỚI THƯ VIỆN</div><h2>{mode === 'register' ? 'Tạo góc đọc của bạn' : 'Rất vui khi bạn trở lại'}</h2><p>{mode === 'register' ? 'Tạo tài khoản để lưu sách và thảo luận trên máy chủ.' : 'Đăng nhập để tiếp tục hành trình đọc.'}</p><label>TÊN ĐĂNG NHẬP<div className="auth-input"><UserRound size={18}/><input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Tên của bạn" required/></div></label><label>MẬT KHẨU<div className="auth-input"><LockKeyhole size={18}/><input type={visible ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" required/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'register' ? 'Tạo hồ sơ' : 'Đăng nhập'}</button><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>{mode === 'register' ? 'Đã có hồ sơ? Đăng nhập' : 'Chưa có hồ sơ? Tạo tài khoản'}</button><div className="auth-note">Tài khoản lưu trên máy chủ Thư Các. Chưa có khôi phục mật khẩu qua email; hãy giữ bản sao lưu cá nhân.</div></form></div></div>
}
