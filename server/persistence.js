import { DatabaseSync } from 'node:sqlite'
import { Pool } from 'pg'
import { gzipSync, gunzipSync } from 'node:zlib'
import { mkdir, readFile as localReadFile, readdir, stat, unlink as localUnlink, writeFile as localWriteFile } from 'node:fs/promises'
import { join } from 'node:path'

function missingFile(name) {
  const error = new Error(`Không tìm thấy tệp: ${name}`)
  error.code = 'ENOENT'
  return error
}

export async function openPersistence(root, PoolClass = Pool) {
  const files = join(root, 'files')
  const url = process.env.DATABASE_URL
  if (!url) {
    if (process.env.REQUIRE_DATABASE_URL === 'true') throw new Error('Thiếu DATABASE_URL. Hãy thêm chuỗi kết nối Supabase vào biến môi trường Render.')
    await mkdir(files, { recursive: true })
    const db = new DatabaseSync(join(root, 'thu-cac.sqlite'))
    return { db, files, remote: false, readFile: localReadFile, writeFile: localWriteFile, unlink: localUnlink, checkpoint: async () => {}, health: async () => {}, close: async () => db.close() }
  }
  if (url.includes('[YOUR-DATABASE-PASSWORD]')) throw new Error('DATABASE_URL vẫn chứa mật khẩu mẫu; hãy nhập mật khẩu thật trong biến môi trường Render.')
  const pool = new PoolClass({ connectionString: url, ssl: { rejectUnauthorized: true }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 })
  pool.on('error', error => console.error('Kết nối PostgreSQL nhàn rỗi bị ngắt:', error.code || error.message))
  try {
    await pool.query('SELECT 1')
    await pool.query('CREATE TABLE IF NOT EXISTS thu_cac_state (id INTEGER PRIMARY KEY, snapshot BYTEA NOT NULL, version BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())')
    await pool.query('CREATE TABLE IF NOT EXISTS thu_cac_files (name TEXT PRIMARY KEY, body BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())')
    let state = (await pool.query('SELECT snapshot,version FROM thu_cac_state WHERE id=1')).rows[0]
    if (!state) {
      const dbPath = join(root, 'thu-cac.sqlite')
      const hasOldDatabase = await stat(dbPath).then(value => value.isFile()).catch(() => false)
      let initialDb = new DatabaseSync(hasOldDatabase ? dbPath : ':memory:')
      // SQLite cannot deserialize a WAL-mode file into an in-memory database.
      if (hasOldDatabase) initialDb.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE')
      const snapshot = gzipSync(initialDb.serialize())
      initialDb.close()
      if (hasOldDatabase) {
        const names = await readdir(files).catch(() => [])
        for (const name of names) {
          const path = join(files, name)
          if (!(await stat(path).catch(() => null))?.isFile()) continue
          await pool.query('INSERT INTO thu_cac_files(name,body) VALUES ($1,$2) ON CONFLICT(name) DO NOTHING', [path, await localReadFile(path)])
        }
      }
      await pool.query('INSERT INTO thu_cac_state(id,snapshot,version) VALUES (1,$1,0) ON CONFLICT(id) DO NOTHING', [snapshot])
      state = (await pool.query('SELECT snapshot,version FROM thu_cac_state WHERE id=1')).rows[0]
    }
    const db = new DatabaseSync(':memory:')
    db.deserialize(gunzipSync(state.snapshot))
    let version = Number(state.version)
    let queue = Promise.resolve()
    let fault = null
    function checkpoint() {
      if (fault) return Promise.reject(fault)
      let snapshot
      try { snapshot = gzipSync(db.serialize()) }
      catch (error) { return Promise.reject(error) }
      const job = queue.then(async () => {
        const result = await pool.query('UPDATE thu_cac_state SET snapshot=$1,version=version+1,updated_at=now() WHERE id=1 AND version=$2 RETURNING version', [snapshot, version])
        if (!result.rowCount) throw new Error('Dữ liệu đã được một phiên máy chủ khác cập nhật. Hãy khởi động lại dịch vụ để đồng bộ.')
        version = Number(result.rows[0].version)
      })
      queue = job.catch(error => { fault = error })
      return job
    }
    return {
      db, files, remote: true, checkpoint,
      health: async () => { if (fault) throw fault; await pool.query('SELECT 1') },
      readFile: async name => { const row = (await pool.query('SELECT body FROM thu_cac_files WHERE name=$1', [name])).rows[0]; if (!row) throw missingFile(name); return row.body },
      writeFile: async (name, buffer) => { await pool.query('INSERT INTO thu_cac_files(name,body) VALUES ($1,$2)', [name, buffer]) },
      unlink: async name => { await pool.query('DELETE FROM thu_cac_files WHERE name=$1', [name]) },
      close: async () => { await queue; db.close(); await pool.end() },
    }
  } catch (error) {
    await pool.end().catch(() => {})
    throw error
  }
}
