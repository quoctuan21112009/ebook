import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openPersistence } from '../server/persistence.js'

class FakePool {
  static state = null
  static files = new Map()
  on() {}
  async end() {}
  async query(sql, params = []) {
    if (sql === 'SELECT 1' || sql.startsWith('CREATE TABLE')) return { rows: [], rowCount: 0 }
    if (sql.startsWith('SELECT snapshot,version')) return { rows: FakePool.state ? [FakePool.state] : [], rowCount: FakePool.state ? 1 : 0 }
    if (sql.startsWith('INSERT INTO thu_cac_state')) {
      if (!FakePool.state) FakePool.state = { snapshot: params[0], version: 0 }
      return { rows: [], rowCount: 1 }
    }
    if (sql.startsWith('UPDATE thu_cac_state')) {
      if (FakePool.state.version !== params[1]) return { rows: [], rowCount: 0 }
      FakePool.state = { snapshot: params[0], version: FakePool.state.version + 1 }
      return { rows: [{ version: FakePool.state.version }], rowCount: 1 }
    }
    if (sql.startsWith('INSERT INTO thu_cac_files')) {
      if (!FakePool.files.has(params[0])) FakePool.files.set(params[0], params[1])
      return { rows: [], rowCount: 1 }
    }
    if (sql.startsWith('SELECT body FROM thu_cac_files')) return { rows: FakePool.files.has(params[0]) ? [{ body: FakePool.files.get(params[0]) }] : [], rowCount: FakePool.files.has(params[0]) ? 1 : 0 }
    if (sql.startsWith('DELETE FROM thu_cac_files')) { FakePool.files.delete(params[0]); return { rows: [], rowCount: 1 } }
    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

test('imports existing SQLite and book files, then restores them from PostgreSQL snapshots', async () => {
  const oldUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test.invalid/postgres'
  FakePool.state = null
  FakePool.files = new Map()
  const dir = await mkdtemp(join(tmpdir(), 'thu-cac-pg-'))
  const files = join(dir, 'files')
  const oldFile = join(files, 'existing.epub')
  const newFile = join(files, 'new.epub')
  try {
    await mkdir(files)
    const local = new DatabaseSync(join(dir, 'thu-cac.sqlite'))
    local.exec("PRAGMA journal_mode=WAL; CREATE TABLE books_test(title TEXT); INSERT INTO books_test VALUES ('Sách cũ')")
    local.close()
    await writeFile(oldFile, Buffer.from('old epub'))
    const first = await openPersistence(dir, FakePool)
    const stale = await openPersistence(dir, FakePool)
    assert.equal(first.remote, true)
    assert.equal(first.db.prepare('SELECT title FROM books_test').get().title, 'Sách cũ')
    assert.equal((await first.readFile(oldFile)).toString(), 'old epub')
    first.db.prepare('INSERT INTO books_test VALUES (?)').run('Sách mới')
    await first.writeFile(newFile, Buffer.from('new epub'))
    await first.checkpoint()
    await assert.rejects(stale.checkpoint(), /phiên máy chủ khác/)
    await stale.close()
    await first.close()
    await rm(dir, { recursive: true, force: true })
    const second = await openPersistence(dir, FakePool)
    assert.deepEqual(second.db.prepare('SELECT title FROM books_test ORDER BY title').all().map(row => row.title), ['Sách cũ', 'Sách mới'])
    assert.equal((await second.readFile(newFile)).toString(), 'new epub')
    await second.close()
  } finally {
    await rm(dir, { recursive: true, force: true })
    if (oldUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = oldUrl
  }
})

test('Render refuses to start without its required DATABASE_URL', async () => {
  const oldUrl = process.env.DATABASE_URL
  const oldRequired = process.env.REQUIRE_DATABASE_URL
  delete process.env.DATABASE_URL
  process.env.REQUIRE_DATABASE_URL = 'true'
  try { await assert.rejects(openPersistence('/tmp/unused-thu-cac-storage'), /Thiếu DATABASE_URL/) }
  finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = oldUrl
    if (oldRequired === undefined) delete process.env.REQUIRE_DATABASE_URL
    else process.env.REQUIRE_DATABASE_URL = oldRequired
  }
})

test('new PostgreSQL storage keeps records after a fresh server restart', async () => {
  const oldUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test.invalid/postgres'
  FakePool.state = null
  FakePool.files = new Map()
  const dir = await mkdtemp(join(tmpdir(), 'thu-cac-new-pg-'))
  try {
    const first = await openPersistence(dir, FakePool)
    first.db.exec("PRAGMA journal_mode=WAL; CREATE TABLE notes(body TEXT); INSERT INTO notes VALUES ('Đã lưu trên Supabase')")
    await first.checkpoint()
    await first.close()
    const second = await openPersistence(dir, FakePool)
    assert.equal(second.db.prepare('SELECT body FROM notes').get().body, 'Đã lưu trên Supabase')
    await second.close()
  } finally {
    await rm(dir, { recursive: true, force: true })
    if (oldUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = oldUrl
  }
})
