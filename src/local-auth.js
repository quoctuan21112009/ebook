const sessionKey = 'tc-local-session-v1'
export function localSession() { return localStorage.getItem(sessionKey) }
export function clearLocalSession() { localStorage.removeItem(sessionKey) }
export function localEnter(username) {
  const name = username.trim().replace(/\s+/g, ' ')
  localStorage.setItem(sessionKey, name)
  return name
}
