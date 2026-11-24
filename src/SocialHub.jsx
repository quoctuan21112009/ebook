import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, ChevronUp, ChevronDown, Flame, MessageCircle, ShieldCheck, Trophy } from 'lucide-react'

const tags = ['Tất cả','Bổ sung kiến thức','Phản biện','Cảm nhận']

export default function SocialHub({ books, onOpenBook, toast }) {
  const [comments, setComments] = useState([])
  const [topics, setTopics] = useState([])
  const [leaders, setLeaders] = useState([])
  const [tag, setTag] = useState('Tất cả')
  const [topic, setTopic] = useState(0)
  useEffect(() => {
    Promise.all([fetch('/api/comments').then(r=>r.json()),fetch('/api/arena').then(r=>r.json()),fetch('/api/leaderboard').then(r=>r.json())])
      .then(([c,a,l]) => { setComments(c.comments||[]);setTopics(a.topics||[]);setLeaders(l.users||[]) }).catch(()=>toast('Không tải được thảo luận cộng đồng.'))
  }, [])
  const visible = comments.filter(c => tag==='Tất cả'||c.tag===tag)
  const selected = topics[topic]
  const debate = selected ? comments.filter(c => c.bookId===selected.book_id && c.quote===selected.quote).sort((a,b)=>b.score-a.score) : []
  async function vote(id, value) {
    const response=await fetch(`/api/comments/${id}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})})
    const result=await response.json()
    if (!response.ok) {toast(result.error||'Không thể bình chọn.');return}
    setComments(v=>v.map(c=>c.id===id?result.comment:c))
  }
  function card(c) { const book=books.find(b=>b.id===c.bookId); return <article className={`social-comment ${c.collapsed?'collapsed':''}`} key={c.id}><div className="social-comment-head"><span className="social-user">{c.username} <small>{c.trust==='Học giả'?'✦ Học giả':''}</small></span><span className={`social-tag tag-${c.tag==='Phản biện'?'counter':c.tag==='Cảm nhận'?'feeling':'knowledge'}`}>{c.tag}</span></div><blockquote>“{c.quote}”</blockquote>{c.collapsed ? <details><summary>Bình luận bị ẩn do điểm thấp ({c.score}). Xem nội dung</summary><p>{c.body}</p></details> : <p>{c.body}</p>}<div className="social-comment-foot"><span><BookOpen size={13}/> {book?.title||'Sách đã xóa'}</span><div className="vote-control"><button onClick={()=>vote(c.id,c.myVote===1?0:1)} className={c.myVote===1?'on':''} aria-label="Ủng hộ"><ChevronUp size={17}/></button><b>{c.score}</b><button onClick={()=>vote(c.id,c.myVote===-1?0:-1)} className={c.myVote===-1?'on':''} aria-label="Không đồng ý"><ChevronDown size={17}/></button></div></div>{book && <button className="social-go" onClick={()=>onOpenBook(book,c.cfi)}>Đọc đoạn này <ArrowRight size={13}/></button>}</article> }
  return <section className="feature-page social-hub"><div className="feature-hero"><div className="eyebrow">MẠNG XÃ HỘI ĐỌC SÁCH</div><h1>Tranh luận bắt đầu từ một câu chữ.</h1><p>Mỗi ý kiến được gắn vào đoạn sách cụ thể, để cuộc trò chuyện luôn có ngữ cảnh.</p></div><div className="social-stats"><div><MessageCircle size={20}/><strong>{comments.length}</strong><span>thảo luận</span></div><div><BookOpen size={20}/><strong>{books.filter(b=>b.visibility==='public').length}</strong><span>sách công khai</span></div><div><Flame size={20}/><strong>{topics.length}</strong><span>chủ đề phản biện</span></div></div><div className="social-layout"><div><div className="social-section-title"><div className="eyebrow small">ĐẤU TRƯỜNG QUAN ĐIỂM</div><h2>Ý kiến đang được bàn luận</h2></div>{selected ? <div className="arena-card"><div className="arena-topics">{topics.map((t,i)=><button className={topic===i?'active':''} key={`${t.book_id}-${t.quote}`} onClick={()=>setTopic(i)}>{i+1}. {t.title}</button>)}</div><blockquote>“{selected.quote}”</blockquote><span className="arena-book">{selected.title} · {selected.count} phản biện</span><div className="arena-sides"><div><h3>Bổ sung & cảm nhận</h3>{debate.filter(c=>c.tag!=='Phản biện').slice(0,2).map(c=><p key={c.id}>{c.body} <b>+{c.score}</b></p>)}{!debate.some(c=>c.tag!=='Phản biện')&&<p>Chưa có góc nhìn bổ sung.</p>}</div><div><h3>Phản biện</h3>{debate.filter(c=>c.tag==='Phản biện').slice(0,2).map(c=><p key={c.id}>{c.body} <b>{c.score}</b></p>)}</div></div></div> : <div className="arena-empty"><Flame size={30}/><h3>Chưa có đấu trường nào</h3><p>Hãy đọc một sách công khai, chọn một đoạn văn và viết phản biện đầu tiên.</p></div>}<div className="social-section-title lower"><div className="eyebrow small">BÌNH LUẬN THEO ĐOẠN</div><h2>Luồng thảo luận</h2></div><div className="social-filters">{tags.map(t=><button key={t} className={tag===t?'active':''} onClick={()=>setTag(t)}>{t}</button>)}</div><div className="social-feed">{visible.length?visible.map(card):<div className="feed-empty"><MessageCircle size={28}/><strong>Chưa có bình luận trong mục này.</strong><p>Bôi đen một đoạn trong sách công khai để bắt đầu.</p></div>}</div></div><aside className="leaderboard"><div className="leaderboard-title"><Trophy size={19}/><h2>Bảng cống hiến</h2></div><p>Điểm từ sách chia sẻ và những bình luận hữu ích.</p>{leaders.map((u,i)=><div className="leader-row" key={u.id}><span>{String(i+1).padStart(2,'0')}</span><strong>{u.username}{u.trust==='Học giả'&&<ShieldCheck size={14}/>}</strong><b>{u.karma}</b></div>)}</aside></div></section>
}
