const protectedContent = 'pre,code,table,svg,.poem,.poetry,.verse,[data-preserve-lines]'
const textBlocks = 'p,li,blockquote,dd,dt'
const set = (element, name, value) => element.style.setProperty(name, value, 'important')

export function normalizeReaderDocument(doc) {
  // Keep the element tree stable for EPUB bookmarks and highlight locations.
  doc.querySelectorAll('p').forEach(paragraph => {
    if (paragraph.closest(protectedContent)) return
    const breaks = [...paragraph.querySelectorAll('br')]
    if (!breaks.length || paragraph.textContent.length < 240) return
    const segments = paragraph.innerHTML.split(/<br\s*\/?\s*>/i).map(part => part.replace(/<[^>]*>/g, '').trim())
    // A blank or short line may be a stanza, address or intentional pause.
    if (segments.some(part => part.length < 35)) return
    for (const br of breaks) {
      const spacer = doc.createElement('span')
      spacer.textContent = ' '
      br.replaceWith(spacer)
    }
  })
}

export async function applyReaderTypography(doc, prefs) {
  const size = Math.max(12, Math.min(30, Number(prefs.fontSize) || 20))
  const leading = Math.max(1.3, Math.min(2.2, Number(prefs.lineHeight) || 1.7))
  const family = prefs.font === 'sans' ? '"Thu Cac Sans",sans-serif' : '"Thu Cac Serif",serif'
  const colors = { paper: ['#f5ecd9','#332b24'], white: ['#fffdfa','#252522'], sepia: ['#dec7a3','#3b2b1e'], night: ['#232927','#e7dfce'] }
  const [background, ink] = colors[prefs.theme] || colors.paper
  const body = doc.body
  set(body,'font-family',family);set(body,'font-size',`${size}px`);set(body,'line-height',String(leading))
  set(body,'color',ink);set(body,'background',background)
  set(body,'padding-top','16px');set(body,'padding-bottom','30px')
  set(body,'padding-left',`${Math.max(8,(prefs.margin || 60)/3)}px`);set(body,'padding-right',`${Math.max(8,(prefs.margin || 60)/3)}px`)
  set(body,'box-sizing','border-box');set(body,'text-size-adjust','none');set(body,'-webkit-text-size-adjust','none')
  const prose = [...doc.querySelectorAll(textBlocks)]
  // Some EPUB exporters use a div for each paragraph.
  doc.querySelectorAll('div').forEach(el => {
    if (!el.querySelector(`${textBlocks},div,h1,h2,h3,h4,pre,table`) && el.textContent.trim()) prose.push(el)
  })
  for (const element of doc.querySelectorAll('body *')) {
    if (element.closest(protectedContent)) continue
    if (/^(IMG|VIDEO|AUDIO|BR|HR)$/.test(element.tagName)) continue
    set(element,'font-family',family);set(element,'letter-spacing','normal');set(element,'word-spacing','normal')
    set(element,'font-size','inherit');set(element,'line-height','inherit');set(element,'color','inherit')
  }
  for (const container of doc.querySelectorAll('section,article,div')) {
    if (container.closest(protectedContent) || !container.querySelector(textBlocks)) continue
    for (const name of ['width','height','max-height','min-height','max-width']) set(container,name,name==='width'||name==='height'?'auto':name==='min-height'?'0':'none')
    set(container,'break-inside','auto');set(container,'page-break-inside','auto')
  }
  for (const paragraph of prose) {
    if (paragraph.closest(protectedContent)) continue
    for (const [name,value] of Object.entries({
      'font-size':`${size}px`,'line-height':String(leading),'font-weight':'500',
      'width':'auto','max-width':'100%','height':'auto','min-height':'0','max-height':'none',
      'white-space':'normal','text-align':'left','text-indent':`${prefs.paragraphIndent ?? 1.2}em`,
      'margin-top':'0','margin-bottom':`${prefs.paragraphGap ?? .55}em`,
      'break-before':'auto','break-after':'auto','break-inside':'auto',
      'page-break-before':'auto','page-break-after':'auto','page-break-inside':'auto',
      'overflow-wrap':'break-word','word-break':'normal','hyphens':'none','widows':'2','orphans':'2',
    })) set(paragraph,name,value)
    paragraph.querySelectorAll('span').forEach(span => {
      if (span.closest(protectedContent)) return
      set(span,'display','inline');set(span,'white-space','normal');set(span,'font-size','inherit');set(span,'line-height','inherit')
    })
  }
  for(const heading of doc.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    set(heading,'font-size',`${size * ({H1:1.65,H2:1.4,H3:1.2}[heading.tagName] || 1.1)}px`)
    set(heading,'line-height','1.3');set(heading,'height','auto');set(heading,'max-width','100%')
  }
  for(const image of doc.querySelectorAll('img')) { set(image,'max-width','100%');set(image,'object-fit','contain') }
  await Promise.all([400,500,700].map(weight => doc.fonts.load(`${weight} ${size}px ${family.split(',')[0]}`, 'Tiếng Việt rõ ràng')))
}
