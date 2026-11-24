// Split live text by measured page height, keeping offsets in the EPUB source.
export function sourceRange(element, start, end) {
  const doc = element.ownerDocument
  const walker = doc.createTreeWalker(element, 4)
  const range = doc.createRange()
  let node, offset = 0, begun = false
  while ((node = walker.nextNode())) {
    const next = offset + node.textContent.length
    if (!begun && start <= next) { range.setStart(node, Math.max(0,start-offset)); begun=true }
    if (begun && end <= next) { range.setEnd(node, Math.max(0,end-offset)); return range }
    offset=next
  }
  range.selectNodeContents(element)
  return range
}

export function paginateBlocks(blocks, measure, maxHeight) {
  const pages = []
  let page = []
  measure.replaceChildren()
  const finish = () => {
    if (page.length) { pages.push(page); page = [] }
    measure.replaceChildren()
  }
  for (const block of blocks) {
    if (block.image) { finish(); pages.push([block]); continue }
    const text = block.text
    if (!text.trim()) continue
    let start = 0
    while (start < text.length) {
      const last = measure.lastElementChild
      const joined = start === 0 && block.joinPrevious && last?.tagName === 'P'
      const element = measure.ownerDocument.createElement(joined ? 'span' : block.tag || 'p')
      let separator
      if (joined) {
        separator = measure.ownerDocument.createTextNode(' ')
        last.append(separator, element)
      } else measure.appendChild(element)
      if (start > 0 || block.joinPrevious) element.style.textIndent = '0'
      if (block.pre) element.style.whiteSpace = 'pre-wrap'
      element.textContent = text.slice(start)
      let end = text.length
      if (measure.scrollHeight > maxHeight) {
        let low = start, high = text.length
        while (low < high) {
          const middle = Math.ceil((low + high) / 2)
          element.textContent = text.slice(start, middle)
          if (measure.scrollHeight <= maxHeight) low = middle
          else high = middle - 1
        }
        end = low
        // Never put the beginning of a word on one page and its tail on the next.
        if (end < text.length && !/\s/u.test(text[end - 1] || '') && !/\s/u.test(text[end] || '')) {
          const boundary = text.slice(start, end).search(/\s+\S*$/u)
          if (boundary >= 0) end = start + boundary + 1
          else if (page.length) end = start
        }
        // Carry a tiny orphan fragment to the next page instead of splitting it.
        if (page.length && text.slice(start, end).trim().split(/\s+/u).length < 4) end = start
        if (end <= start) {
          element.remove(); separator?.remove()
          if (page.length) { finish(); continue }
          end = Math.min(text.length, start + 1)
        }
      }
      element.textContent = text.slice(start, end)
      page.push({ ...block, text: text.slice(start, end), start, end })
      start = end
      if (start < text.length) finish()
    }
  }
  finish()
  return pages
}

export function textWithLineBreaks(element) {
  let text='',sourceOffset=0
  const offsets=[0]
  const visit=node=>{
    if(node.nodeType===3){for(const character of node.textContent.split('')){text+=character;sourceOffset+=character.length;offsets[text.length]=sourceOffset}}
    else if(node.nodeType===1&&node.localName?.toLowerCase()==='br'){text+='\n';offsets[text.length]=sourceOffset}
    else for(const child of node.childNodes)visit(child)
  }
  visit(element)
  return {text,offsets}
}
export function blockRange(block,start,end) {
  return sourceRange(block.element,block.offsets?.[start]??start,block.offsets?.[end]??end)
}
