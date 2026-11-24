const protectedContent = 'pre,code,table,svg,.poem,.poetry,.verse,[data-preserve-lines]'

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
