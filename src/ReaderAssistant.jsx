import React, { useState } from 'react'
import { Copy, ExternalLink, Link2, MonitorUp, Sparkles, X } from 'lucide-react'

const providers = [
  { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com', url: 'https://gemini.google.com/app' },
  { id: 'claude', name: 'Claude', host: 'claude.ai', url: 'https://claude.ai/' },
]
let openAiWindow = null
let openAiUrl = ''

export function openAiWebsite(url) {
  const mobile = window.matchMedia('(max-width: 650px)').matches
  if (!mobile && openAiWindow && !openAiWindow.closed && openAiUrl === url) {
    openAiWindow.focus()
    return { opened: true, reused: true, mobile }
  }
  const width = Math.max(380, Math.round(screen.availWidth * .37))
  const height = Math.max(580, screen.availHeight - 30)
  const left = (screen.availLeft || 0) + screen.availWidth - width
  const top = (screen.availTop || 0) + 15
  const features = mobile ? undefined : `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  const popup = window.open(url, mobile ? '_blank' : 'thu_cac_ai_window', features)
  if (!popup) return { opened: false, mobile }
  try { popup.opener = null; popup.focus() } catch {}
  if (!mobile) { openAiWindow = popup; openAiUrl = url }
  return { opened: true, reused: false, mobile }
}

export default function ReaderAssistant({ book, excerpt = '', chapter = '', onClose }) {
  const [providerId, setProviderId] = useState('chatgpt')
  const [conversationUrl, setConversationUrl] = useState('')
  const [notice, setNotice] = useState('')
  const provider = providers.find(item => item.id === providerId)
  const context = `Tôi đang đọc “${book.title}”${book.author ? ` của ${book.author}` : ''}.${chapter ? `\nVị trí hiện tại: ${chapter}.` : ''}${excerpt ? `\nĐoạn tôi muốn thảo luận: “${excerpt.slice(0, 1800)}”` : ''}\nHãy giúp tôi hiểu sâu hơn, phân biệt điều chắc chắn và suy đoán, không tiết lộ phần tôi chưa đọc.`

  function targetUrl() {
    if (!conversationUrl.trim()) return provider.url
    try {
      const url = new URL(conversationUrl.trim())
      const matchingHost = url.hostname === provider.host || (provider.id === 'chatgpt' && url.hostname === 'chat.openai.com') || (provider.id === 'gemini' && url.hostname === 'g.co' && url.pathname.startsWith('/gemini/share'))
      if (url.protocol === 'https:' && matchingHost) return url.href
    } catch {}
    setNotice(`Link cuộc trò chuyện phải thuộc ${provider.host}.`)
    return null
  }

  function launch() {
    const url = targetUrl()
    if (!url) return
    const result = openAiWebsite(url)
    if (!result.opened) { setNotice('Trình duyệt đã chặn cửa sổ. Hãy cho phép pop-up cho Thư Các rồi thử lại.'); return }
    if (result.reused) {
      setNotice(`Đã chuyển sang cửa sổ ${provider.name} đang mở.`)
      return
    }
    setNotice(result.mobile ? `${provider.name} đã mở trong thẻ mới.` : `${provider.name} đã mở cạnh sách. Bạn có thể kéo hai cửa sổ để chỉnh độ rộng.`)
  }

  async function copyContext() {
    try { await navigator.clipboard.writeText(context); setNotice('Đã sao chép đoạn sách. Dán vào cuộc trò chuyện AI của bạn.') }
    catch { setNotice('Không sao chép được. Hãy chọn nội dung trong khung bên dưới.') }
  }

  return <aside className="reader-assistant" aria-label="Cửa sổ AI cạnh sách"><header><div><span>✦ ĐỌC VÀ TRAO ĐỔI</span><h2><Sparkles size={19}/> AI cạnh sách</h2></div><button onClick={onClose} aria-label="Đóng AI"><X size={19}/></button></header>
    <div className="assistant-context"><strong>{book.title}</strong><small>{excerpt ? `“${excerpt.slice(0, 180)}${excerpt.length > 180 ? '…' : ''}”` : chapter || 'Chọn một đoạn để mang vào cuộc trò chuyện.'}</small></div>
    <div className="ai-window-content"><div className="ai-window-illustration"><MonitorUp size={35}/><strong>Cuộc trò chuyện của bạn, ngay cạnh trang sách</strong><p>Chọn website AI bạn đã đăng nhập. Cửa sổ mở ở bên phải, giữ nguyên lịch sử chat của bạn.</p></div>
      <div className="ai-window-providers" role="group" aria-label="Chọn trang AI">{providers.map(item => <button key={item.id} className={providerId === item.id ? 'active' : ''} onClick={() => { setProviderId(item.id); setConversationUrl(''); setNotice('') }}>{item.name}</button>)}</div>
      <label className="ai-window-label" htmlFor="conversation-url"><Link2 size={15}/> Link cuộc trò chuyện đang có <span>(tùy chọn)</span></label><input id="conversation-url" type="url" value={conversationUrl} onChange={event => setConversationUrl(event.target.value)} placeholder={`https://${provider.host}/...`}/>
      <button className="ai-window-launch" onClick={launch}><ExternalLink size={17}/> Mở {provider.name} cạnh sách</button>
      <label className="ai-window-label" htmlFor="book-context"><Copy size={15}/> Đoạn sách để gửi sang AI</label><textarea id="book-context" readOnly value={context} rows="5" onClick={event => event.target.select()}/><button className="ai-window-copy" onClick={copyContext}><Copy size={16}/> Sao chép đoạn sách</button>
      {notice && <p className="ai-window-notice" role="status">{notice}</p>}
      <p className="ai-window-help">Các website AI này không có cách nhúng được hỗ trợ trong Thư Các; trình duyệt có thể chặn iframe. Cửa sổ bên cạnh là chính website của họ, cùng tài khoản và các cuộc trò chuyện bạn đã có.</p>
    </div>
  </aside>
}
