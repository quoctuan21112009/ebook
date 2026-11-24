const accountsKey = 'tc-local-accounts-v1'
const sessionKey = 'tc-local-session-v1'

function accounts() {
  try { return JSON.parse(localStorage.getItem(accountsKey) || '{}') } catch { return {} }
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt), iterations: 160000, hash: 'SHA-256' }, key, 256)
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function localSession() { return localStorage.getItem(sessionKey) }
export function clearLocalSession() { localStorage.removeItem(sessionKey) }

export async function localAuth(mode, username, password) {
  const all = accounts()
  if (mode === 'register') {
    if (all[username]) throw new Error('Tên hồ sơ này đã có trên thiết bị.')
    const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    all[username] = { salt, hash: await passwordHash(password, salt) }
    localStorage.setItem(accountsKey, JSON.stringify(all))
  } else {
    const account = all[username]
    if (!account || await passwordHash(password, account.salt) !== account.hash) throw new Error('Tên đăng nhập hoặc mật khẩu chưa đúng trên thiết bị này.')
  }
  localStorage.setItem(sessionKey, username)
  return username
}
