const SIZE = { width: 1080, height: 1350 }
const scenes = {
  mountain: { image: '/landscapes/mountain-morning.webp', ink: '#183b30', accent: '#ac6b38', paper: '#faf0d8' },
  valley: { image: '/landscapes/emerald-valley.webp', ink: '#f8e9c7', accent: '#dfbd7d', paper: '#193d32' },
  room: { image: '/landscapes/reading-room.webp', ink: '#fff1d1', accent: '#eac58e', paper: '#3b281c' },
}

function imageAt(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

function lines(ctx, value, width) {
  const words = String(value).replace(/\s+/g, ' ').trim().split(' ')
  const result = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) line = next
    else { result.push(line); line = word }
  }
  if (line) result.push(line)
  return result
}

export async function renderQuoteImage({ quote, caption, title, author, username, scene = 'mountain' }) {
  const palette = scenes[scene] || scenes.mountain
  const canvas = document.createElement('canvas')
  canvas.width = SIZE.width; canvas.height = SIZE.height
  const ctx = canvas.getContext('2d')
  const image = await imageAt(palette.image).catch(() => null)
  ctx.fillStyle = palette.paper; ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (image) {
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
    const w = image.width * scale, h = image.height * scale
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
  }
  const dark = scene !== 'mountain'
  const fade = ctx.createLinearGradient(0, 0, 0, 1350)
  fade.addColorStop(0, dark ? '#102b20dd' : '#fff8e9dd')
  fade.addColorStop(.58, dark ? '#102b20e8' : '#fff8e9ef')
  fade.addColorStop(1, dark ? '#102b20f5' : '#fff8e9f8')
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 1080, 1350)
  ctx.strokeStyle = palette.accent; ctx.lineWidth = 2
  ctx.strokeRect(44, 44, 992, 1262); ctx.strokeRect(61, 61, 958, 1228)
  ctx.fillStyle = palette.accent; ctx.textAlign = 'center'
  ctx.font = '700 30px "Be Vietnam Pro", sans-serif'; ctx.fillText('✦   THƯ CÁC · TRANG SÁCH ĐÁNG NHỚ   ✦', 540, 145)
  ctx.font = '120px Georgia, serif'; ctx.fillText('“', 540, 315)
  const normalized = quote.trim().replace(/\s+/g, ' ')
  const excerpt = normalized.length > 320 ? `${normalized.slice(0, 317).trimEnd()}…` : normalized
  let size = 65, quoteLines = []
  while (size >= 37) {
    ctx.font = `700 ${size}px "Noto Serif", Georgia, serif`
    quoteLines = lines(ctx, excerpt, 806)
    if (quoteLines.length <= 9 && quoteLines.length * size * 1.55 <= 660) break
    size -= 3
  }
  ctx.fillStyle = palette.ink; ctx.textAlign = 'center'
  ctx.font = `700 ${size}px "Noto Serif", Georgia, serif`
  let y = 430 + Math.max(0, (9 - quoteLines.length) * 16)
  for (const line of quoteLines) { ctx.fillText(line, 540, y); y += size * 1.52 }
  ctx.fillStyle = palette.accent; ctx.fillRect(395, Math.min(1040, y + 15), 290, 2)
  ctx.fillStyle = palette.ink
  ctx.font = '700 38px "Noto Serif", Georgia, serif'
  ctx.fillText(title.slice(0, 42), 540, 1107)
  ctx.font = '28px "Be Vietnam Pro", sans-serif'
  ctx.fillText(author?.slice(0, 48) || 'Một trang sách', 540, 1153)
  if (caption.trim()) {
    ctx.font = 'italic 26px "Noto Serif", Georgia, serif'
    const captionLines = lines(ctx, caption.trim().slice(0, 120), 800).slice(0, 2)
    captionLines.forEach((line, index) => ctx.fillText(line, 540, 1200 + index * 38))
  }
  ctx.font = '700 24px "Be Vietnam Pro", sans-serif'
  ctx.fillStyle = palette.accent
  ctx.fillText(`ĐỌC CÙNG @${username.slice(0, 28).toLocaleUpperCase('vi')}`, 540, 1274)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không tạo được ảnh.')), 'image/webp', .78))
}

export async function compressImage(file) {
  const url = URL.createObjectURL(file)
  let source
  try { source = await imageAt(url) }
  finally { URL.revokeObjectURL(url) }
  const canvas = document.createElement('canvas')
  for (const [max, quality] of [[1500, .72], [1200, .62], [960, .52]]) {
    const scale = Math.min(1, max / Math.max(source.width, source.height))
    canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale)
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob) throw new Error('Không nén được ảnh.')
    if (blob.size <= 800 * 1024) return blob
  }
  throw new Error('Ảnh quá lớn sau khi nén. Hãy chọn ảnh khác.')
}
