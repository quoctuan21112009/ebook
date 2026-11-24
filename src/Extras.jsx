import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, Copy, ExternalLink, MessageCircle, Music2, Pause, Play, Plus, Search, Send, Star, Volume2 } from 'lucide-react'

const providers = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'Claude', url: 'https://claude.ai/' },
]

export function AiHub({ books, annotations, toast }) {
  const [bookId, setBookId] = useState(books[0]?.id || '')
  const [question, setQuestion] = useState('')
  const book = books.find(b => b.id === bookId)
  const notes = annotations[bookId] || []
  const prompt = `Tôi đang đọc cuốn “${book?.title || 'một cuốn sách'}”${book?.author ? ` của ${book.author}` : ''}. ${question || 'Hãy giúp tôi thảo luận và đặt những câu hỏi sâu hơn về cuốn sách.'}${notes.length ? `\n\nCác đoạn tôi đã ghi chú:\n${notes.slice(-5).map(a => `- ${a.text}${a.note ? ` — ${a.note}` : ''}`).join('\n')}` : ''}\n\nHãy trả lời bằng tiếng Việt, phân biệt thông tin chắc chắn với suy đoán, và tránh tiết lộ nội dung chưa đọc nếu tôi chưa yêu cầu.`
  async function copy() {
    try { await navigator.clipboard.writeText(prompt); toast('Đã sao chép câu hỏi và ghi chú') }
    catch { toast('Không thể sao chép. Hãy chọn và sao chép nội dung bên dưới.') }
  }
  return <section className="feature-page"><div className="feature-hero"><div className="eyebrow">GÓC BÀN LUẬN</div><h1>Đọc cùng một góc nhìn mới.</h1><p>Mang câu hỏi và ghi chú sang AI bạn thích để tiếp tục cuộc trò chuyện.</p></div><div className="ai-layout"><div className="feature-card"><h2>Chuẩn bị câu hỏi</h2><label>CUỐN SÁCH</label><select value={bookId} onChange={e => setBookId(e.target.value)}><option value="">Chọn sách</option>{books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select><label>ĐIỀU BẠN MUỐN BÀN LUẬN</label><textarea value={question} onChange={e => setQuestion(e.target.value)} rows="5" placeholder="Ví dụ: Nhân vật thay đổi như thế nào qua các chương?"/><div className="prompt-preview"><span>BẢN XEM TRƯỚC CÂU HỎI</span><p>{prompt}</p></div><button className="feature-primary" onClick={copy}><Copy size={17}/> Sao chép câu hỏi</button></div><div className="feature-card ai-providers"><h2>Mở không gian AI</h2><p>Sao chép câu hỏi trước, rồi dán vào trang AI. Bạn đăng nhập trực tiếp tại trang đó.</p>{providers.map(p => <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"><span className="provider-initial">{p.name[0]}</span><span>{p.name}<small>Trò chuyện trên {p.name}</small></span><ExternalLink size={17}/></a>)}<div className="provider-note">Trình duyệt không cho trang này truy cập cuộc hội thoại trên các website AI. Không cần nhập khóa API tại Thư Các.</div></div></div></section>
}

const sounds = [
  { id: 'piano', title: 'Piano dịu nhẹ', subtitle: 'Giai điệu tập trung', notes: [261.63, 329.63, 392, 523.25] },
  { id: 'rain', title: 'Mưa bên hiên', subtitle: 'Âm thanh nền êm dịu', notes: [196, 246.94, 293.66, 392] },
  { id: 'night', title: 'Đêm yên tĩnh', subtitle: 'Không gian thư giãn', notes: [174.61, 220, 261.63, 349.23] },
]

export function MusicDock() {
  const [open, setOpen] = useState(false)
  const [track, setTrack] = useState(null)
  const [query, setQuery] = useState('')
  const [volume, setVolume] = useState(.17)
  const audio = useRef(null)
  useEffect(() => {
    if (!track) { audio.current?.context.close(); audio.current = null; return }
    const context = new AudioContext()
    const gain = context.createGain(); gain.gain.value = volume; gain.connect(context.destination)
    const nodes = []; let timer
    if (track === 'piano') {
      const notes = [261.63,329.63,392,523.25,392,329.63,293.66,392,493.88,587.33,493.88,392]
      let index = 0
      const playNote = () => {
        const now = context.currentTime, oscillator = context.createOscillator(), voice = context.createGain()
        oscillator.type = 'sine'; oscillator.frequency.value = notes[index++ % notes.length]
        voice.gain.setValueAtTime(.001, now); voice.gain.exponentialRampToValueAtTime(.42, now+.025); voice.gain.exponentialRampToValueAtTime(.001, now+.58)
        oscillator.connect(voice); voice.connect(gain); oscillator.start(now); oscillator.stop(now+.6)
      }
      playNote(); timer = setInterval(playNote, 570)
    } else if (track === 'rain') {
      const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate)
      const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.32
      const source=context.createBufferSource(),filter=context.createBiquadFilter()
      source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=850
      source.connect(filter);filter.connect(gain);source.start();nodes.push(source)
    } else {
      sounds.find(s => s.id === track)?.notes.forEach((frequency,index)=>{const oscillator=context.createOscillator(),voice=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency/2;voice.gain.value=.15/(index+1);oscillator.connect(voice);voice.connect(gain);oscillator.start();nodes.push(oscillator)})
    }
    audio.current = { context, gain, nodes }
    return () => { if(timer)clearInterval(timer);nodes.forEach(n => {try{n.stop()}catch{}});context.close() }
  }, [track])
  useEffect(() => { if (audio.current) audio.current.gain.gain.value = volume }, [volume])
  return <div className="music-dock"><button className={`music-toggle ${track ? 'playing' : ''}`} onClick={() => setOpen(!open)} title="Âm thanh khi đọc"><Music2 size={21}/>{track && <span className="music-wave">▂▅▃</span>}</button>{open && <div className="music-panel"><div className="music-head"><Music2 size={18}/><strong>Âm thanh đọc sách</strong></div><div className="music-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm âm thanh..."/></div>{sounds.filter(s => s.title.toLowerCase().includes(query.toLowerCase())).map(s => <button key={s.id} className={`music-track ${track === s.id ? 'active' : ''}`} onClick={() => setTrack(track === s.id ? null : s.id)}><span>{track === s.id ? <Pause size={16}/> : <Play size={16}/>}</span><span>{s.title}<small>{s.subtitle}</small></span></button>)}<div className="music-volume"><Volume2 size={16}/><input type="range" min="0" max="0.5" step="0.01" value={volume} onChange={e => setVolume(+e.target.value)}/></div><a href="https://www.youtube.com/results?search_query=nh%E1%BA%A1c+%C4%91%E1%BB%8Dc+s%C3%A1ch" target="_blank" rel="noopener noreferrer">Tìm thêm nhạc trên YouTube <ArrowRight size={14}/></a><p>Âm thanh nền được tạo trực tiếp trên thiết bị.</p></div>}</div>
}
