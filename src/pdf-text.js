// Reconstruct PDF text using glyph positions rather than a space per PDF item.
export function cleanPdfText(text) {
  return String(text || '').normalize('NFC').replace(/\u00ad/g, '').replace(/[\u200b\ufeff]/g, '')
    .replace(/([\p{L}\p{N}])\s+(?=\p{M})/gu, '$1').normalize('NFC')
}

export function pdfItemSeparator(previous, current) {
  if (!previous) return ''
  if (previous.hasEOL) return '\n'
  const before = cleanPdfText(previous.str), after = cleanPdfText(current.str)
  if (!before || !after || /\s$/u.test(before) || /^\s/u.test(after)) return ''
  if (/^\p{M}/u.test(after)) return ''
  const size = Math.max(6, previous.height || 0, current.height || 0,
    Math.hypot(current.transform?.[0] || 0, current.transform?.[1] || 0))
  const [x, y] = [current.transform?.[4] || 0, current.transform?.[5] || 0]
  const [px, py] = [previous.transform?.[4] || 0, previous.transform?.[5] || 0]
  if (Math.abs(y - py) > size * .4 || x < px - size) return '\n'
  return x - (px + (previous.width || 0)) > Math.max(1.3, size * .23) ? ' ' : ''
}

// These are not valid Vietnamese letters; a repeated pattern usually means a
// custom PDF font has supplied a broken ToUnicode map. Never guess its meaning.
export function needsPdfOcr(text) {
  const value = cleanPdfText(text)
  if (!value.trim()) return true
  if (/[\ufffd\u0000-\u0008\ue000-\uf8ff]/u.test(value)) return true
  const foreign = value.match(/[ĕĔęĘĭĬŏŎŭŬîÎëËäÄöÖüÜ]/gu) || []
  return foreign.length >= 2 && foreign.length / Math.max(1, value.replace(/\s/g, '').length) > .015
}

export function pdfSelectionText(range) {
  // cloneContents preserves our text-node boundaries, unlike the browser's
  // geometry-based spacing for absolutely positioned selection spans.
  return cleanPdfText(range.cloneContents().textContent).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()
}
