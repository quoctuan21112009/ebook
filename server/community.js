import { randomUUID } from 'node:crypto'

const clean = (value, limit) => String(value || '').trim().slice(0, limit)
const allowedKinds = new Set(['feed', 'forum'])

export function registerCommunityRoutes(app, db, currentUser, requireUser) {
  db.exec(`CREATE TABLE IF NOT EXISTS community_pages (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE UNIQUE, description TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS community_follows (user_id TEXT NOT NULL, page_id TEXT NOT NULL, PRIMARY KEY(user_id,page_id));
  CREATE TABLE IF NOT EXISTS community_posts (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, page_id TEXT, kind TEXT NOT NULL, body TEXT NOT NULL, book_id TEXT, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS community_replies (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS community_likes (user_id TEXT NOT NULL, post_id TEXT NOT NULL, PRIMARY KEY(user_id,post_id));
  CREATE TABLE IF NOT EXISTS community_saves (user_id TEXT NOT NULL, post_id TEXT NOT NULL, PRIMARY KEY(user_id,post_id));
  CREATE TABLE IF NOT EXISTS community_reports (user_id TEXT NOT NULL, post_id TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id,post_id));
  CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created DESC);
  CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);`)

  function overview(req, res) {
    const user = currentUser(req)
    const uid = user?.id || ''
    const pages = db.prepare(`SELECT p.id,p.name,p.description,p.created,u.username owner,
      (SELECT count(*) FROM community_follows f WHERE f.page_id=p.id) followers,
      EXISTS(SELECT 1 FROM community_follows f WHERE f.page_id=p.id AND f.user_id=?) followed,
      (SELECT count(*) FROM community_posts s WHERE s.page_id=p.id) posts
      FROM community_pages p JOIN users u ON u.id=p.owner_id ORDER BY followers DESC,p.created DESC LIMIT 100`).all(uid)
    const posts = db.prepare(`SELECT p.id,p.page_id pageId,p.kind,p.body,p.book_id bookId,p.created,u.username author,g.name pageName,b.title bookTitle,
      (SELECT count(*) FROM community_likes l WHERE l.post_id=p.id) likes,
      EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id=p.id AND l.user_id=?) liked,
      EXISTS(SELECT 1 FROM community_saves s WHERE s.post_id=p.id AND s.user_id=?) saved,
      (SELECT count(*) FROM community_replies r WHERE r.post_id=p.id) replyCount
      FROM community_posts p JOIN users u ON u.id=p.author_id LEFT JOIN community_pages g ON g.id=p.page_id LEFT JOIN books b ON b.id=p.book_id
      ORDER BY p.created DESC LIMIT 100`).all(uid, uid)
    const replies = db.prepare(`SELECT r.id,r.post_id postId,r.body,r.created,u.username author FROM community_replies r JOIN users u ON u.id=r.author_id WHERE r.post_id=? ORDER BY r.created ASC LIMIT 100`)
    res.json({ pages, posts: posts.map(post => ({ ...post, replies: replies.all(post.id) })) })
  }
  app.get('/api/community', overview)
  app.post('/api/community/pages', requireUser, (req, res) => {
    const name = clean(req.body.name, 60).replace(/\s+/g, ' ')
    const description = clean(req.body.description, 500)
    if (name.length < 3 || description.length < 10) return res.status(400).json({ error: 'Tên fanpage cần 3 ký tự và giới thiệu cần 10 ký tự.' })
    if (db.prepare('SELECT count(*) count FROM community_pages WHERE owner_id=?').get(req.user.id).count >= 3) return res.status(429).json({ error: 'Mỗi người có thể tạo tối đa 3 fanpage.' })
    const nameKey = name.normalize('NFC').toLocaleLowerCase('vi')
    if (db.prepare('SELECT name FROM community_pages').all().some(page => page.name.normalize('NFC').toLocaleLowerCase('vi') === nameKey)) return res.status(409).json({ error: 'Tên fanpage đã được dùng.' })
    db.prepare('INSERT INTO community_pages VALUES (?,?,?,?,?)').run(randomUUID(), req.user.id, name, description, Date.now())
    overview(req, res)
  })
  app.post('/api/community/pages/:id/follow', requireUser, (req, res) => {
    if (!db.prepare('SELECT id FROM community_pages WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Không tìm thấy fanpage.' })
    const params = [req.user.id, req.params.id]
    if (db.prepare('SELECT 1 FROM community_follows WHERE user_id=? AND page_id=?').get(...params)) db.prepare('DELETE FROM community_follows WHERE user_id=? AND page_id=?').run(...params)
    else db.prepare('INSERT INTO community_follows VALUES (?,?)').run(...params)
    overview(req, res)
  })
  app.post('/api/community/posts', requireUser, (req, res) => {
    const body = clean(req.body.body, 3000)
    const kind = clean(req.body.kind, 20)
    const pageId = clean(req.body.pageId, 50) || null
    const bookId = clean(req.body.bookId, 50) || null
    if (!allowedKinds.has(kind) || body.length < 3) return res.status(400).json({ error: 'Bài viết cần ít nhất 3 ký tự.' })
    if (pageId && !db.prepare('SELECT id FROM community_pages WHERE id=? AND owner_id=?').get(pageId, req.user.id)) return res.status(403).json({ error: 'Chỉ người tạo fanpage được đăng bài lên trang.' })
    if (bookId && !db.prepare("SELECT id FROM books WHERE id=? AND visibility='public'").get(bookId)) return res.status(400).json({ error: 'Chỉ có thể gắn sách công khai.' })
    if (db.prepare('SELECT count(*) count FROM community_posts WHERE author_id=? AND created>?').get(req.user.id, Date.now()-86400000).count >= 20) return res.status(429).json({ error: 'Bạn đã đăng 20 bài hôm nay. Hãy quay lại ngày mai.' })
    db.prepare('INSERT INTO community_posts VALUES (?,?,?,?,?,?,?)').run(randomUUID(), req.user.id, pageId, kind, body, bookId, Date.now())
    overview(req, res)
  })
  app.post('/api/community/posts/:id/replies', requireUser, (req, res) => {
    const body = clean(req.body.body, 1000)
    if (body.length < 2 || !db.prepare('SELECT id FROM community_posts WHERE id=?').get(req.params.id)) return res.status(400).json({ error: 'Bình luận cần ít nhất 2 ký tự và một bài viết hợp lệ.' })
    if (db.prepare('SELECT count(*) count FROM community_replies WHERE author_id=? AND created>?').get(req.user.id, Date.now()-86400000).count >= 100) return res.status(429).json({ error: 'Bạn đã bình luận quá nhiều hôm nay.' })
    db.prepare('INSERT INTO community_replies VALUES (?,?,?,?,?)').run(randomUUID(), req.params.id, req.user.id, body, Date.now())
    overview(req, res)
  })
  for (const [action, table] of [['like','community_likes'], ['save','community_saves']]) {
    app.post(`/api/community/posts/:id/${action}`, requireUser, (req, res) => {
      if (!db.prepare('SELECT id FROM community_posts WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
      const params = [req.user.id, req.params.id]
      if (db.prepare(`SELECT 1 FROM ${table} WHERE user_id=? AND post_id=?`).get(...params)) db.prepare(`DELETE FROM ${table} WHERE user_id=? AND post_id=?`).run(...params)
      else db.prepare(`INSERT INTO ${table} VALUES (?,?)`).run(...params)
      overview(req, res)
    })
  }
  app.delete('/api/community/posts/:id', requireUser, (req, res) => {
    const post = db.prepare('SELECT author_id FROM community_posts WHERE id=?').get(req.params.id)
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Chỉ tác giả được xóa bài viết.' })
    for (const table of ['community_replies','community_likes','community_saves','community_reports']) db.prepare(`DELETE FROM ${table} WHERE post_id=?`).run(req.params.id)
    db.prepare('DELETE FROM community_posts WHERE id=?').run(req.params.id)
    overview(req, res)
  })
  app.post('/api/community/posts/:id/report', requireUser, (req, res) => {
    if (!db.prepare('SELECT id FROM community_posts WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Không tìm thấy bài viết.' })
    const reason = clean(req.body.reason, 300)
    if (reason.length < 5) return res.status(400).json({ error: 'Hãy ghi lý do báo cáo ít nhất 5 ký tự.' })
    db.prepare('INSERT INTO community_reports VALUES (?,?,?,?) ON CONFLICT(user_id,post_id) DO UPDATE SET reason=excluded.reason,created=excluded.created').run(req.user.id, req.params.id, reason, Date.now())
    res.json({ ok: true })
  })
}
