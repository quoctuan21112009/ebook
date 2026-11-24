import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function waitForServer(base, process) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (process.exitCode !== null) throw new Error('API stopped before becoming ready')
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('API did not start')
}

test('guest identity keeps ownership while community posts persist', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'thu-cac-community-'))
  const port = 35000 + Math.floor(Math.random() * 15000)
  const base = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, PORT: String(port) }, stdio: 'ignore' })
  try {
    await waitForServer(base, server)
    async function call(path, method = 'GET', body, cookie = '') {
      const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
      return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0], data: await response.json() }
    }
    const first = await call('/api/identity/enter', 'POST', { username: 'Độc giả Một' })
    assert.equal(first.status, 201)
    assert.equal(first.data.user.username, 'Độc giả Một')
    const a = first.cookie
    assert.equal((await call('/api/identity/enter', 'POST', { username: 'độc giả một' })).status, 409)
    const second = await call('/api/identity/enter', 'POST', { username: 'Độc giả Hai' })
    assert.equal(second.status, 201)
    const b = second.cookie
    const bookForm = new FormData()
    bookForm.set('file', new Blob([Buffer.from('PK\x03\x04test')], { type: 'application/epub+zip' }), 'test.epub')
    bookForm.set('title', 'Sách của độc giả Một')
    bookForm.set('visibility', 'public')
    bookForm.set('rights', 'true')
    assert.equal((await fetch(`${base}/api/books`, { method: 'POST', headers: { Cookie: a }, body: bookForm })).status, 201)
    const ownBooks = await call('/api/books', 'GET', undefined, a)
    const otherBooks = await call('/api/books', 'GET', undefined, b)
    assert.equal(ownBooks.data.books[0].mine, true)
    assert.equal(otherBooks.data.books[0].mine, false)
    const page = await call('/api/community/pages', 'POST', { name: 'Trang Sách Xanh', description: 'Đọc và trao đổi về sách thiên nhiên.' }, a)
    assert.equal(page.status, 200)
    const pageId = page.data.pages[0].id
    assert.equal((await call('/api/community/posts', 'POST', { kind: 'feed', pageId, body: 'Giả mạo bài đăng' }, b)).status, 403)
    const published = await call('/api/community/posts', 'POST', { kind: 'feed', pageId, body: 'Một cuốn sách làm tôi suy nghĩ rất lâu.' }, a)
    assert.equal(published.status, 200)
    const postId = published.data.posts[0].id
    const followed = await call(`/api/community/pages/${pageId}/follow`, 'POST', {}, b)
    assert.equal(followed.data.pages[0].followers, 1)
    const liked = await call(`/api/community/posts/${postId}/like`, 'POST', {}, b)
    assert.equal(liked.data.posts[0].likes, 1)
    const replied = await call(`/api/community/posts/${postId}/replies`, 'POST', { body: 'Mình cũng muốn đọc cuốn này.' }, b)
    assert.equal(replied.data.posts[0].replies[0].author, 'Độc giả Hai')
    const image = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
    const form = new FormData()
    form.set('kind', 'feed')
    form.set('body', 'Một đoạn sách muốn chia sẻ bằng ảnh.')
    form.set('image', new Blob([image], { type: 'image/webp' }), 'trich-dan.webp')
    const imagePost = await fetch(`${base}/api/community/posts`, { method: 'POST', headers: { Cookie: a }, body: form })
    assert.equal(imagePost.status, 200)
    const imageData = await imagePost.json()
    const imageId = imageData.posts.find(item => item.imageUrl)?.id
    assert.ok(imageId)
    const served = await fetch(`${base}/api/community/posts/${imageId}/image`)
    assert.equal(served.status, 200)
    assert.equal(served.headers.get('content-type'), 'image/webp')
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), image)
    assert.equal((await call(`/api/community/posts/${imageId}`, 'DELETE', undefined, b)).status, 403)
    assert.equal((await call(`/api/community/posts/${imageId}`, 'DELETE', undefined, a)).status, 200)
    assert.equal((await fetch(`${base}/api/community/posts/${imageId}/image`)).status, 404)
    assert.equal((await call(`/api/community/posts/${postId}`, 'DELETE', undefined, b)).status, 403)
    assert.equal((await call(`/api/community/posts/${postId}`, 'DELETE', undefined, a)).data.posts.length, 0)
  } finally {
    server.kill('SIGTERM')
    await rm(dir, { recursive: true, force: true })
  }
})
