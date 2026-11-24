import express from 'express'
import multer from 'multer'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { registerCommunityRoutes } from './community.js'

const scrypt = promisify(scryptCallback)
const root = resolve(process.env.DATA_DIR || '.data')
const files = join(root, 'files')
await mkdir(files, { recursive: true })
const db = new DatabaseSync(join(root, 'thu-cac.sqlite'))
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, karma INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, author TEXT, genre TEXT, tags TEXT, type TEXT NOT NULL, sha256 TEXT NOT NULL, file_path TEXT NOT NULL, cover_path TEXT, cover_mime TEXT, quote TEXT, created INTEGER NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', FOREIGN KEY(owner_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS user_state (user_id TEXT NOT NULL, book_id TEXT NOT NULL, progress TEXT, annotations TEXT, rating INTEGER DEFAULT 0, personal_quote TEXT, PRIMARY KEY(user_id,book_id));
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, user_id TEXT NOT NULL, cfi TEXT, quote TEXT NOT NULL, body TEXT NOT NULL, tag TEXT NOT NULL, parent_id TEXT, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS votes (user_id TEXT NOT NULL, comment_id TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(user_id,comment_id));
CREATE TABLE IF NOT EXISTS merge_proposals (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, proposer_id TEXT NOT NULL, sha256 TEXT NOT NULL, file_path TEXT NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, cover_path TEXT, cover_mime TEXT);`)
try { db.exec("ALTER TABLE books ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'") } catch {}
try { db.exec('ALTER TABLE books ADD COLUMN normalized_path TEXT') } catch {}
try { db.exec('ALTER TABLE merge_proposals ADD COLUMN cover_path TEXT') } catch {}
try { db.exec('ALTER TABLE merge_proposals ADD COLUMN cover_mime TEXT') } catch {}
db.exec('CREATE INDEX IF NOT EXISTS idx_books_hash ON books(sha256)')
db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' }) }
    catch { return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' }) }
  }
  next()
})
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 3 } })
const authWindow = new Map()
function limitAuth(req,res,next) {
  const key=req.socket.remoteAddress || 'unknown';const now=Date.now();const item=authWindow.get(key)
  if (!item || now-item.start>15*60*1000) {authWindow.set(key,{start:now,count:1});return next()}
  if (item.count>=30) return res.status(429).json({error:'Quá nhiều lần đăng nhập. Hãy thử lại sau 15 phút.'})
  item.count++;next()
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const digest = value => createHash('sha256').update(value).digest('hex')
const clean = (value, max = 300) => String(value || '').trim().slice(0, max)
const publicUser = user => ({ id: user.id, username: user.username, karma: user.karma, trust: user.karma >= 100 ? 'Học giả' : user.karma < 0 ? 'Hạn chế' : 'Thành viên' })

function currentUser(req) {
  const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('tc_session='))?.slice(11)
  if (!cookie) return null
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?').get(digest(cookie), Date.now())
  return row || null
}
function requireUser(req, res, next) { req.user = currentUser(req); if (!req.user) return res.status(401).json({ error: 'Hãy đăng nhập trước.' }); next() }
function createSession(req, res, user) {
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), user.id, Date.now() + 365 * 86400000)
  res.cookie('tc_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && (req.secure || process.env.COOKIE_SECURE === 'true'), maxAge: 365 * 86400000, path: '/' })
}

app.get('/api/health', (_, res) => res.json({ ok: true }))
app.post('/api/auth/register', limitAuth, asyncRoute(async (req, res) => {
  const username = clean(req.body.username, 30).toLowerCase()
  const password = String(req.body.password || '')
  if (!/^[a-z0-9_.-]{3,30}$/.test(username) || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.' })
  if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' })
  const salt = randomBytes(16).toString('hex'); const hash = (await scrypt(password, salt, 64)).toString('hex')
  const id = randomUUID(); db.prepare('INSERT INTO users(id,username,salt,hash,created) VALUES (?,?,?,?,?)').run(id, username, salt, hash, Date.now())
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id); createSession(req, res, user); res.json({ user: publicUser(user) })
}))
app.post('/api/auth/login', limitAuth, asyncRoute(async (req, res) => {
  const username = clean(req.body.username, 30).toLowerCase()
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username)
  const candidate = await scrypt(String(req.body.password || ''), user?.salt || 'dummy', 64)
  if (!user || !timingSafeEqual(candidate, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' })
  createSession(req, res, user); res.json({ user: publicUser(user) })
}))
app.post('/api/identity/enter', limitAuth, (req, res) => {
  const username = clean(req.body.username, 30).replace(/\s+/g, ' ')
  if (username.length < 2 || !/^[\p{L}\p{N}_ .-]+$/u.test(username)) return res.status(400).json({ error: 'Tên hiển thị không hợp lệ.' })
  const key = username.normalize('NFC').toLocaleLowerCase('vi')
  if (db.prepare('SELECT username FROM users').all().some(user => user.username.normalize('NFC').toLocaleLowerCase('vi') === key)) return res.status(409).json({ error: 'Tên này đã được dùng. Hãy chọn tên khác; tên cũ có thể thuộc tài khoản được bảo vệ.' })
  const id = randomUUID()
  db.prepare('INSERT INTO users(id,username,salt,hash,created) VALUES (?,?,?,?,?)').run(id, username, randomBytes(16).toString('hex'), randomBytes(64).toString('hex'), Date.now())
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id)
  createSession(req, res, user)
  res.status(201).json({ user: publicUser(user) })
})
app.post('/api/auth/logout', requireUser, (req, res) => { const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('tc_session='))?.slice(11); if (cookie) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(cookie)); res.clearCookie('tc_session'); res.json({ ok: true }) })
app.get('/api/me', (req, res) => { const user = currentUser(req); res.json({ user: user ? publicUser(user) : null }) })

function bookRow(row, user) { return { id: row.id, title: row.title, author: row.author, type: row.type, sha256: row.sha256, genre: row.genre, tags: JSON.parse(row.tags || '[]'), quote: row.quote, uploader: row.username, karma: row.karma, added: row.created, coverUrl: row.cover_path ? `/api/books/${row.id}/cover?v=${row.sha256.slice(0,12)}` : null, hasReflow: !!row.normalized_path, mine: row.owner_id === user?.id, visibility: row.visibility, commentCount: row.comment_count || 0 } }
app.get('/api/books', (req, res) => {
  const user = currentUser(req); const q = clean(req.query.q, 100); const genre = clean(req.query.genre, 60); const uploader = clean(req.query.uploader, 30)
  const rows = db.prepare(`SELECT b.*,u.username,u.karma,(SELECT count(*) FROM comments c WHERE c.book_id=b.id) comment_count FROM books b JOIN users u ON u.id=b.owner_id WHERE (b.visibility='public' OR b.owner_id=?) AND (?='' OR b.title LIKE ? OR b.author LIKE ? OR b.tags LIKE ?) AND (?='' OR b.genre=?) AND (?='' OR u.username=?) ORDER BY b.created DESC LIMIT 100`).all(user?.id||'',q,`%${q}%`,`%${q}%`,`%${q}%`,genre,genre,uploader,uploader)
  res.json({ books: rows.map(row => bookRow(row, user)) })
})
app.get('/api/books/:id/cover', asyncRoute(async (req, res) => { const row = db.prepare('SELECT owner_id,visibility,cover_path,cover_mime FROM books WHERE id=?').get(req.params.id); if (!row?.cover_path || (row.visibility==='private' && row.owner_id!==currentUser(req)?.id)) return res.status(404).end(); res.type(row.cover_mime || 'image/jpeg').send(await readFile(row.cover_path)) }))
app.get('/api/books/:id/file', requireUser, asyncRoute(async (req, res) => { const row = db.prepare('SELECT owner_id,visibility,file_path,type FROM books WHERE id=?').get(req.params.id); if (!row || (row.visibility==='private' && row.owner_id!==req.user.id)) return res.status(404).end(); res.type(row.type === 'pdf' ? 'application/pdf' : 'application/epub+zip').send(await readFile(row.file_path)) }))
app.get('/api/books/:id/epub', requireUser, asyncRoute(async (req,res) => { const row=db.prepare('SELECT owner_id,visibility,normalized_path FROM books WHERE id=?').get(req.params.id); if (!row?.normalized_path || (row.visibility==='private' && row.owner_id!==req.user.id)) return res.status(404).end(); res.type('application/epub+zip').send(await readFile(row.normalized_path)) }))
app.post('/api/books', requireUser, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }, { name: 'normalized', maxCount: 1 }]), asyncRoute(async (req, res) => {
  const visibility = req.body.visibility === 'public' ? 'public' : 'private'
  if (visibility === 'public' && req.body.rights !== 'true') return res.status(400).json({ error: 'Hãy xác nhận bạn có quyền chia sẻ tệp này.' })
  const file = req.files?.file?.[0]; if (!file) return res.status(400).json({ error: 'Thiếu tệp sách.' })
  const type = file.originalname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub'
  const valid = type === 'pdf' ? file.buffer.subarray(0,4).toString() === '%PDF' : file.buffer.subarray(0,2).toString() === 'PK'
  if (!valid) return res.status(400).json({ error: 'Định dạng tệp không hợp lệ.' })
  const sha256 = digest(file.buffer)
  const duplicate = db.prepare("SELECT id,title FROM books WHERE sha256=? AND (visibility='public' OR owner_id=?)").get(sha256,req.user.id)
  if (duplicate) return res.status(409).json({ error: 'Sách này đã có trong thư viện. Hãy đề xuất bản tốt hơn để hợp nhất.', duplicate })
  const sameTitle = visibility==='public' ? db.prepare("SELECT id,title FROM books WHERE visibility='public' AND lower(title)=lower(?) AND lower(coalesce(author,''))=lower(?) LIMIT 1").get(clean(req.body.title,200),clean(req.body.author,150)) : null
  if (sameTitle) return res.status(409).json({error:'Đã có sách cùng tên và tác giả. Hãy gửi bản này làm đề xuất hợp nhất.',duplicate:sameTitle,mergeAvailable:true})
  const id = randomUUID(); const filePath = join(files, `${id}.${type}`)
  await writeFile(filePath, file.buffer, { flag: 'wx' })
  const cover = req.files?.cover?.[0]; let coverPath = null
  if (cover && /^image\/(png|jpeg|webp)$/.test(cover.mimetype) && cover.size < 3 * 1024 * 1024) { coverPath = join(files, `${id}.cover`); await writeFile(coverPath, cover.buffer, { flag: 'wx' }) }
  const normalized = req.files?.normalized?.[0]; let normalizedPath = null
  if (type==='pdf' && normalized?.buffer.subarray(0,2).toString()==='PK') { normalizedPath=join(files,`${id}.epub`); await writeFile(normalizedPath,normalized.buffer,{flag:'wx'}) }
  const tags = JSON.stringify(String(req.body.tags || '').split(',').map(x => clean(x, 30)).filter(Boolean).slice(0,8))
  db.prepare('INSERT INTO books(id,owner_id,title,author,genre,tags,type,sha256,file_path,cover_path,cover_mime,quote,created,visibility,normalized_path) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,req.user.id,clean(req.body.title,200)||file.originalname,clean(req.body.author,150),clean(req.body.genre,60),tags,type,sha256,filePath,coverPath,cover?.mimetype || null,clean(req.body.quote,1000),Date.now(),visibility,normalizedPath)
  if (visibility==='public') db.prepare('UPDATE users SET karma=karma+10 WHERE id=?').run(req.user.id)
  const row=db.prepare('SELECT b.*,u.username,u.karma,0 comment_count FROM books b JOIN users u ON u.id=b.owner_id WHERE b.id=?').get(id)
  res.status(201).json({ book: bookRow(row, req.user) })
}))
app.patch('/api/books/:id', requireUser, (req, res) => {
  const row=db.prepare('SELECT owner_id FROM books WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Không tìm thấy sách.' })
  if (row.owner_id!==req.user.id) return res.status(403).json({ error: 'Chỉ người đóng góp được sửa thông tin.' })
  const tags=JSON.stringify(Array.isArray(req.body.tags)?req.body.tags.map(x=>clean(x,30)).slice(0,8):[])
  db.prepare('UPDATE books SET title=?,author=?,genre=?,tags=?,quote=? WHERE id=?').run(clean(req.body.title,200),clean(req.body.author,150),clean(req.body.genre,60),tags,clean(req.body.quote,1000),req.params.id)
  res.json({ ok:true })
})
app.delete('/api/books/:id', requireUser, asyncRoute(async (req,res) => {
  const row=db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({error:'Không tìm thấy sách.'})
  if (row.owner_id!==req.user.id) return res.status(403).json({error:'Chỉ người đóng góp được xóa sách.'})
  db.prepare('DELETE FROM votes WHERE comment_id IN (SELECT id FROM comments WHERE book_id=?)').run(row.id)
  db.prepare('DELETE FROM comments WHERE book_id=?').run(row.id)
  const pending=db.prepare("SELECT file_path,cover_path FROM merge_proposals WHERE book_id=? AND status='pending'").all(row.id)
  db.prepare('DELETE FROM merge_proposals WHERE book_id=?').run(row.id)
  db.prepare('DELETE FROM user_state WHERE book_id=?').run(row.id)
  db.prepare('DELETE FROM books WHERE id=?').run(row.id)
  await unlink(row.file_path).catch(()=>{})
  if (row.cover_path) await unlink(row.cover_path).catch(()=>{})
  if (row.normalized_path) await unlink(row.normalized_path).catch(()=>{})
  for (const item of pending) { await unlink(item.file_path).catch(()=>{}); if (item.cover_path) await unlink(item.cover_path).catch(()=>{}) }
  res.json({ok:true})
}))
app.post('/api/books/:id/proposals', requireUser, upload.fields([{name:'file',maxCount:1},{name:'cover',maxCount:1}]), asyncRoute(async (req,res) => {
  const book=db.prepare('SELECT * FROM books WHERE id=? AND visibility=\'public\'').get(req.params.id)
  if (!book) return res.status(404).json({error:'Không tìm thấy sách công khai.'})
  if (req.body.rights!=='true') return res.status(400).json({error:'Hãy xác nhận quyền chia sẻ tệp.'})
  const file=req.files?.file?.[0]
  if (!file || !file.originalname.toLowerCase().endsWith(`.${book.type}`)) return res.status(400).json({error:'Bản đề xuất phải cùng định dạng với sách hiện có.'})
  if (book.type==='pdf' ? file.buffer.subarray(0,4).toString()!=='%PDF' : file.buffer.subarray(0,2).toString()!=='PK') return res.status(400).json({error:'Định dạng tệp đề xuất không hợp lệ.'})
  const sha256=digest(file.buffer)
  if (sha256===book.sha256) return res.status(409).json({error:'Tệp này giống hệt bản hiện có.'})
  const id=randomUUID(); const path=join(files,`${id}.proposal.${book.type}`)
  await writeFile(path,file.buffer,{flag:'wx'})
  const cover=req.files?.cover?.[0];let coverPath=null
  if (cover && /^image\/(png|jpeg|webp)$/.test(cover.mimetype) && cover.size<3*1024*1024) {coverPath=join(files,`${id}.proposal.cover`);await writeFile(coverPath,cover.buffer,{flag:'wx'})}
  db.prepare('INSERT INTO merge_proposals(id,book_id,proposer_id,sha256,file_path,note,status,created,cover_path,cover_mime) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,book.id,req.user.id,sha256,path,clean(req.body.note,500),'pending',Date.now(),coverPath,cover?.mimetype||null)
  res.status(201).json({ok:true})
}))
app.get('/api/books/:id/proposals', requireUser, (req,res) => {
  const book=db.prepare('SELECT owner_id FROM books WHERE id=?').get(req.params.id)
  if (!book || book.owner_id!==req.user.id) return res.status(403).json({error:'Chỉ người đăng sách được xem đề xuất.'})
  const proposals=db.prepare("SELECT p.id,p.note,p.created,u.username FROM merge_proposals p JOIN users u ON u.id=p.proposer_id WHERE p.book_id=? AND p.status='pending' ORDER BY p.created DESC").all(req.params.id)
  res.json({proposals})
})
app.get('/api/proposals/:id/file', requireUser, asyncRoute(async (req,res) => {
  const row=db.prepare('SELECT p.file_path,p.status,b.owner_id,b.type FROM merge_proposals p JOIN books b ON b.id=p.book_id WHERE p.id=?').get(req.params.id)
  if (!row || row.owner_id!==req.user.id || row.status!=='pending') return res.status(403).end()
  res.type(row.type==='pdf'?'application/pdf':'application/epub+zip').attachment(`de-xuat.${row.type}`).send(await readFile(row.file_path))
}))
app.post('/api/proposals/:id/resolve', requireUser, asyncRoute(async (req,res) => {
  const proposal=db.prepare('SELECT p.*,b.owner_id,b.file_path old_path,b.cover_path old_cover,b.normalized_path old_normalized,b.type FROM merge_proposals p JOIN books b ON b.id=p.book_id WHERE p.id=?').get(req.params.id)
  if (!proposal || proposal.owner_id!==req.user.id || proposal.status!=='pending') return res.status(403).json({error:'Đề xuất không hợp lệ.'})
  const accept=req.body.accept===true
  if (accept) {
    const comments=db.prepare('SELECT count(*) count FROM comments WHERE book_id=?').get(proposal.book_id).count
    const reading=db.prepare('SELECT count(*) count FROM user_state WHERE book_id=? AND (progress IS NOT NULL OR annotations IS NOT NULL)').get(proposal.book_id).count
    if (comments || reading) return res.status(409).json({error:'Sách đã có vị trí đọc hoặc thảo luận. Chưa thể thay tệp mà không làm lệch ghi chú; hãy từ chối đề xuất hoặc tạo ấn bản riêng.'})
    db.prepare('UPDATE books SET file_path=?,sha256=?,normalized_path=NULL,cover_path=coalesce(?,cover_path),cover_mime=coalesce(?,cover_mime) WHERE id=?').run(proposal.file_path,proposal.sha256,proposal.cover_path,proposal.cover_mime,proposal.book_id)
    db.prepare('UPDATE users SET karma=karma+5 WHERE id=?').run(proposal.proposer_id)
    await unlink(proposal.old_path).catch(()=>{})
    if (proposal.old_normalized) await unlink(proposal.old_normalized).catch(()=>{})
    if (proposal.cover_path && proposal.old_cover) await unlink(proposal.old_cover).catch(()=>{})
  } else {await unlink(proposal.file_path).catch(()=>{});if(proposal.cover_path)await unlink(proposal.cover_path).catch(()=>{})}
  db.prepare('UPDATE merge_proposals SET status=? WHERE id=?').run(accept?'accepted':'rejected',proposal.id)
  res.json({ok:true})
}))
app.get('/api/books/:id/state', requireUser, (req,res) => { const row=db.prepare('SELECT * FROM user_state WHERE user_id=? AND book_id=?').get(req.user.id,req.params.id); res.json({ progress: row?.progress ? JSON.parse(row.progress) : null, annotations: row?.annotations ? JSON.parse(row.annotations) : [], rating: row?.rating || 0, personalQuote: row?.personal_quote || '' }) })
app.put('/api/books/:id/state', requireUser, (req,res) => {
  if (!db.prepare('SELECT id FROM books WHERE id=?').get(req.params.id)) return res.status(404).json({ error:'Không tìm thấy sách.' })
  const progress=JSON.stringify(req.body.progress || null), annotations=JSON.stringify(Array.isArray(req.body.annotations)?req.body.annotations:[])
  if (annotations.length > 250000) return res.status(413).json({ error:'Ghi chú quá lớn.' })
  db.prepare('INSERT INTO user_state VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET progress=excluded.progress, annotations=excluded.annotations, rating=excluded.rating, personal_quote=excluded.personal_quote').run(req.user.id,req.params.id,progress,annotations,Math.max(0,Math.min(5,Number(req.body.rating)||0)),clean(req.body.personalQuote,1000))
  res.json({ ok:true })
})

function commentDto(row, user) { const score=db.prepare('SELECT coalesce(sum(v.value * CASE WHEN u.karma>=100 THEN 5 ELSE 1 END),0) score FROM votes v JOIN users u ON u.id=v.user_id WHERE v.comment_id=?').get(row.id).score; const myVote=user?db.prepare('SELECT value FROM votes WHERE user_id=? AND comment_id=?').get(user.id,row.id)?.value||0:0; return { id:row.id,bookId:row.book_id,cfi:row.cfi,quote:row.quote,body:row.body,tag:row.tag,parentId:row.parent_id,created:row.created,username:row.username,trust:row.karma>=100?'Học giả':row.karma<0?'Hạn chế':'Thành viên',score,myVote,collapsed:score<=-5 } }
app.get('/api/comments', (req,res) => { const bookId=clean(req.query.bookId,40); const tag=clean(req.query.tag,30); const user=currentUser(req); const rows=db.prepare(`SELECT c.*,u.username,u.karma FROM comments c JOIN users u ON u.id=c.user_id JOIN books b ON b.id=c.book_id WHERE b.visibility='public' AND (?='' OR c.book_id=?) AND (?='' OR c.tag=?) ORDER BY c.created DESC LIMIT 200`).all(bookId,bookId,tag,tag); res.json({ comments:rows.map(row=>commentDto(row,user)) }) })
app.post('/api/comments', requireUser, (req,res) => {
  const {bookId,cfi,parentId}=req.body; const tag=clean(req.body.tag,30)
  if (!['Bổ sung kiến thức','Phản biện','Cảm nhận'].includes(tag)) return res.status(400).json({ error:'Hãy chọn nhãn bình luận.' })
  const quote=clean(req.body.quote,1000),body=clean(req.body.body,2000)
  if (!quote || body.length<3 || !db.prepare("SELECT id FROM books WHERE id=? AND visibility='public'").get(bookId)) return res.status(400).json({ error:'Bình luận cần đoạn trích và nội dung của sách công khai.' })
  if (req.user.karma<0 && db.prepare('SELECT count(*) c FROM comments WHERE user_id=? AND created>?').get(req.user.id,Date.now()-86400000).c>=1) return res.status(429).json({ error:'Tài khoản đang giới hạn một bình luận mỗi ngày.' })
  const id=randomUUID();db.prepare('INSERT INTO comments VALUES (?,?,?,?,?,?,?,?,?)').run(id,bookId,req.user.id,clean(cfi,1000),quote,body,tag,parentId||null,Date.now())
  db.prepare('UPDATE users SET karma=karma+1 WHERE id=?').run(req.user.id)
  const row=db.prepare('SELECT c.*,u.username,u.karma FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?').get(id)
  res.status(201).json({ comment:commentDto(row,req.user) })
})
app.post('/api/comments/:id/vote', requireUser, (req,res) => {
  const value=Number(req.body.value); if (![1,-1,0].includes(value)) return res.status(400).json({ error:'Phiếu không hợp lệ.' })
  const comment=db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id); if (!comment) return res.status(404).json({ error:'Không tìm thấy bình luận.' })
  if (comment.user_id===req.user.id) return res.status(400).json({ error:'Không thể bình chọn bình luận của chính mình.' })
  const old=db.prepare('SELECT value FROM votes WHERE user_id=? AND comment_id=?').get(req.user.id,comment.id)?.value||0
  if (value===0) db.prepare('DELETE FROM votes WHERE user_id=? AND comment_id=?').run(req.user.id,comment.id)
  else db.prepare('INSERT INTO votes VALUES (?,?,?) ON CONFLICT(user_id,comment_id) DO UPDATE SET value=excluded.value').run(req.user.id,comment.id,value)
  db.prepare('UPDATE users SET karma=karma+? WHERE id=?').run((value-old)*(req.user.karma>=100?5:1),comment.user_id)
  const row=db.prepare('SELECT c.*,u.username,u.karma FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?').get(comment.id)
  res.json({ comment:commentDto(row,req.user) })
})
app.get('/api/arena', (req,res) => { const rows=db.prepare(`SELECT c.quote,c.book_id,b.title,count(*) count FROM comments c JOIN books b ON b.id=c.book_id WHERE c.tag='Phản biện' AND b.visibility='public' GROUP BY c.book_id,c.quote ORDER BY count DESC LIMIT 8`).all(); res.json({ topics:rows }) })
app.get('/api/leaderboard', (req,res) => { const users=db.prepare('SELECT id,username,karma FROM users ORDER BY karma DESC LIMIT 20').all(); res.json({ users:users.map(publicUser) }) })
registerCommunityRoutes(app, db, currentUser, requireUser)
app.use('/api', (_,res)=>res.status(404).json({error:'Không tìm thấy API.'}))
if (process.env.NODE_ENV==='production') { app.use(express.static(resolve('dist'))); app.get('*path',(_,res)=>res.sendFile(resolve('dist/index.html'))) }
app.use((error,req,res,next)=>{ console.error(error); res.status(error.code==='LIMIT_FILE_SIZE'?413:500).json({error:error.code==='LIMIT_FILE_SIZE'?'Tệp vượt quá 50 MB.':'Máy chủ gặp lỗi.'}) })
app.listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log(`Thư Các API ready on ${process.env.PORT||3001}`))
