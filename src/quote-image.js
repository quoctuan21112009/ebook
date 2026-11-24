import { quoteTemplates } from './quote-templates'

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

function decoration(ctx, palette) {
  ctx.save(); ctx.strokeStyle = palette.accent; ctx.fillStyle = palette.accent; ctx.globalAlpha = .24; ctx.lineWidth = 2
  const pattern = palette.pattern
  for (let i = 0; i < 24; i++) {
    const x = (i * 173 + 37) % 1080, y = (i * 251 + 93) % 1440
    ctx.beginPath()
    if (pattern === 'leaves' || pattern === 'petals') {
      ctx.ellipse(x,y,20 + i % 3 * 8,65,(i % 6)*.55,0,Math.PI*2); ctx.stroke()
      ctx.moveTo(x-35,y+70);ctx.lineTo(x+35,y-70);ctx.stroke()
    } else if (pattern === 'stars') {
      ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke()
    } else if (pattern === 'tiles') { ctx.strokeRect(x,y,65,65) }
  }
  if (['waves','dunes','arches'].includes(pattern)) {
    for (let i=0;i<9;i++) { ctx.beginPath();ctx.moveTo(-50,80+i*170);ctx.bezierCurveTo(280,-40+i*170,720,300+i*170,1150,80+i*170);ctx.stroke() }
  }
  if (['grid','linen'].includes(pattern)) {
    const step=pattern==='linen'?8:80;ctx.globalAlpha=pattern==='linen'?.08:.18
    for(let x=0;x<1080;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1440);ctx.stroke()}
    for(let y=0;y<1440;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1080,y);ctx.stroke()}
  }
  if(pattern==='sun'){ctx.beginPath();ctx.arc(930,170,250,0,Math.PI*2);ctx.fill()}
  if(pattern==='grain'){
    ctx.globalAlpha=.12
    for(let i=0;i<6000;i++)ctx.fillRect((i*127.31)%1080,(i*179.13)%1440,1,1)
  }
  ctx.restore()
}

export async function renderQuoteImage({ quote, caption = '', title, author, username, scene = 'ivory', layout = 'page' }) {
  const palette = quoteTemplates.find(item => item.id === scene) || quoteTemplates[0]
  const canvas = document.createElement('canvas')
  // Draw as vectors at double resolution so text stays crisp on large screens.
  canvas.width = 2160; canvas.height = 2880
  const ctx = canvas.getContext('2d');ctx.scale(2,2)
  ctx.fillStyle = palette.paper;ctx.fillRect(0,0,1080,1440)
  decoration(ctx,palette)
  if(layout==='hardcover'||layout==='spread'){
    ctx.save();ctx.shadowColor='#0005';ctx.shadowBlur=28;ctx.shadowOffsetY=15
    ctx.fillStyle=palette.ink;ctx.fillRect(57,62,966,1300);ctx.restore()
    ctx.fillStyle=palette.paper;ctx.fillRect(76,72,928,1274)
    ctx.fillStyle=palette.accent;ctx.globalAlpha=.24;ctx.fillRect(layout==='spread'?530:80,72,layout==='spread'?20:24,1274);ctx.globalAlpha=1
    ctx.fillStyle='#9b2634';ctx.beginPath();ctx.moveTo(900,72);ctx.lineTo(938,72);ctx.lineTo(938,208);ctx.lineTo(919,190);ctx.lineTo(900,208);ctx.closePath();ctx.fill()
  }
  ctx.strokeStyle=palette.accent;ctx.lineWidth=1.5
  ctx.strokeRect(99,98,882,1224)
  if(layout==='postcard'){ctx.setLineDash([5,8]);ctx.strokeRect(80,80,920,1260);ctx.setLineDash([])}
  ctx.textAlign='center';ctx.fillStyle=palette.accent
  ctx.font='700 22px "Be Vietnam Pro", sans-serif';ctx.fillText('T H Ư   C Á C   /   MỘT TRANG ĐÁNG NHỚ',540,169)
  ctx.font='110px Georgia,serif';ctx.fillText('“',540,300)
  const normalized=quote.trim().replace(/\s+/g,' ')
  const excerpt=normalized.length>1100?normalized.slice(0,1097)+'…':normalized
  let size=56,quoteLines=[]
  const columns=layout==='spread'?2:1, textWidth=columns===2?350:740
  do {
    ctx.font=`${size}px "Noto Serif",Georgia,serif`;quoteLines=lines(ctx,excerpt,textWidth)
    if(Math.ceil(quoteLines.length/columns)*size*1.52<=660)break
    size-=2
  } while(size>18)
  ctx.fillStyle=palette.ink;ctx.font=`${size}px "Noto Serif",Georgia,serif`
  const perColumn=Math.ceil(quoteLines.length/columns)
  const height=perColumn*size*1.52
  let y=350+Math.max(0,(660-height)/2)
  const top=y
  quoteLines.forEach((line,index)=>{const column=Math.floor(index/perColumn);ctx.fillText(line,columns===2?(column===0?319:761):540,top+(index%perColumn)*size*1.52)})
  ctx.fillStyle=palette.accent;ctx.fillRect(430,1060,220,2)
  ctx.fillStyle=palette.ink;ctx.font='700 30px "Noto Serif",Georgia,serif'
  lines(ctx,title,760).slice(0,2).forEach((line,i)=>ctx.fillText(line,540,1110+i*40))
  ctx.font='22px "Be Vietnam Pro",sans-serif';ctx.fillText(author?.slice(0,65)||'Một trang sách',540,1205)
  ctx.font='italic 24px "Noto Serif",Georgia,serif'
  lines(ctx,caption.slice(0,160),750).slice(0,2).forEach((line,i)=>ctx.fillText(line,540,1255+i*35))
  ctx.fillStyle=palette.accent;ctx.font='700 20px "Be Vietnam Pro",sans-serif';ctx.fillText(`ĐỌC CÙNG @${username.slice(0,28).toLocaleUpperCase('vi')}`,540,1377)
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được ảnh.')),'image/webp',.94))
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
