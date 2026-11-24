import { cleanPdfText,pdfItemSeparator } from './pdf-text.js'

export async function renderPdfLeaf(doc, number, width = 1400) {
  const page = await doc.getPage(number)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(2.5, width / base.width) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .94))
  const content = await page.getTextContent()
  return { blob, width: viewport.width, height: viewport.height, items: content.items.filter(item=>typeof item.str==='string').map((item,index,items) => {
    const x = item.transform[4] * viewport.scale
    const y = viewport.height - item.transform[5] * viewport.scale
    const height = Math.hypot(item.transform[2], item.transform[3]) * viewport.scale || item.height * viewport.scale
    return { text: cleanPdfText(item.str),separator:pdfItemSeparator(items[index-1],item), left: x / viewport.width * 100, top: (y - height) / viewport.height * 100,
      width: item.width * viewport.scale / viewport.width * 100, height: height / viewport.height * 100 }
  }) }
}

export function addPdfTextLayer(container, block, annotations = []) {
  const layer = document.createElement('div')
  layer.className = 'pdf-leaf-text'
  layer.dataset.pdfPage = String(block.pdfPage)
  for (const item of block.items || []) {
    if (!item.text) continue
    const span = document.createElement('span')
    span.textContent = item.text
    if(item.separator)layer.appendChild(document.createTextNode(item.separator))
    span.style.cssText = `left:${item.left}%;top:${item.top}%;width:${item.width}%;height:${item.height}%;font-size:${item.height}cqh;`
    if(annotations.some(a=>a.type==='highlight'&&a.pdfPage===block.pdfPage&&(item.text.includes(a.text)||a.text.includes(item.text.trim()))))span.style.background='#e5b84970'
    layer.appendChild(span)
  }
  container.appendChild(layer)
}
