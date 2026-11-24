const key = 'tc-community-v1'
function read() {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function write(data) { localStorage.setItem(key, JSON.stringify(data)) }
export function localCommunity(user, action = 'load', payload = {}) {
  const data = read()
  for (const collection of ['pages', 'posts', 'replies', 'likes', 'saves', 'follows', 'reports']) data[collection] ||= []
  const id = () => crypto.randomUUID()
  const now = () => Date.now()
  if (action === 'page') {
    if (data.pages.some(page => page.name.toLocaleLowerCase('vi') === payload.name.toLocaleLowerCase('vi'))) throw new Error('Tên fanpage đã được dùng trên thiết bị này.')
    if (data.pages.filter(page => page.owner === user).length >= 3) throw new Error('Mỗi người có thể tạo tối đa 3 fanpage.')
    data.pages.push({ id: id(), name: payload.name, description: payload.description, owner: user, created: now() })
  }
  if (action === 'follow') {
    const index = data.follows.findIndex(item => item.user === user && item.pageId === payload.id)
    if (index >= 0) data.follows.splice(index, 1)
    else data.follows.push({ user, pageId: payload.id })
  }
  if (action === 'post') {
    if (payload.pageId && data.pages.find(page => page.id === payload.pageId)?.owner !== user) throw new Error('Chỉ chủ fanpage được đăng lên trang.')
    data.posts.push({ id: payload.id || id(), author: user, pageId: payload.pageId || null, kind: payload.kind, body: payload.body, bookId: payload.bookId || null, bookTitle: payload.bookTitle || null, imageKey: payload.imageKey || null, created: now() })
  }
  if (action === 'reply') data.replies.push({ id: id(), postId: payload.id, author: user, body: payload.body, created: now() })
  if (action === 'like' || action === 'save') {
    const items = data[action === 'like' ? 'likes' : 'saves']
    const index = items.findIndex(item => item.user === user && item.postId === payload.id)
    if (index >= 0) items.splice(index, 1)
    else items.push({ user, postId: payload.id })
  }
  if (action === 'delete') {
    const post = data.posts.find(item => item.id === payload.id)
    if (post?.author !== user) throw new Error('Chỉ tác giả được xóa bài viết.')
    data.posts = data.posts.filter(item => item.id !== payload.id)
    data.replies = data.replies.filter(item => item.postId !== payload.id)
    data.likes = data.likes.filter(item => item.postId !== payload.id)
    data.saves = data.saves.filter(item => item.postId !== payload.id)
  }
  if (action === 'report') data.reports.push({ user, postId: payload.id, reason: payload.reason, created: now() })
  write(data)
  return {
    pages: [...data.pages].sort((a, b) => b.created - a.created).map(page => ({ ...page, followers: data.follows.filter(item => item.pageId === page.id).length, followed: data.follows.some(item => item.pageId === page.id && item.user === user), posts: data.posts.filter(item => item.pageId === page.id).length })),
    posts: [...data.posts].sort((a, b) => b.created - a.created).map(post => ({ ...post, pageName: data.pages.find(page => page.id === post.pageId)?.name || null, likes: data.likes.filter(item => item.postId === post.id).length, liked: data.likes.some(item => item.postId === post.id && item.user === user), saved: data.saves.some(item => item.postId === post.id && item.user === user), replies: data.replies.filter(item => item.postId === post.id).sort((a, b) => a.created - b.created), replyCount: data.replies.filter(item => item.postId === post.id).length })),
  }
}
