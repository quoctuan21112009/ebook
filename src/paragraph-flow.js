const protectedSelector = 'pre,code,table,svg,.poem,.poetry,.verse,[data-preserve-lines],li,blockquote'

export function continuesProse(previous, next, alreadyJoined = false) {
  const left = previous.replace(/https?:\/\/\S+\s*$/iu, '').trim()
  const right = next.trim()
  // A short fragment is only joined after a longer, established prose run.
  // Keep sentence endings, dialogue, lists and headings as separate paragraphs.
  return (left.length >= 80 || (alreadyJoined && left.length >= 8)) &&
    !/[.!?…:;][”’"')\]]*$/u.test(left) && /^\p{Ll}/u.test(right) && right.length >= 8
}

export function markParagraphFlow(doc, enabled = true) {
  let previous = null, joined = false
  for (const element of doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,pre,li,blockquote,table,hr,img')) {
    if (element.matches('div') && element.querySelector('p,div,h1,h2,h3,h4,li,pre,blockquote,img,table')) continue
    element.removeAttribute('data-reader-join')
    element.removeAttribute('data-reader-run')
    const prose = element.matches('p,div') && !element.closest(protectedSelector) && !element.querySelector('img,svg,br')
    if (!prose || !element.textContent.trim()) { previous = null; joined = false; continue }
    if (enabled && previous && previous.parentElement === element.parentElement && continuesProse(previous.textContent, element.textContent, joined)) {
      previous.setAttribute('data-reader-run', 'true')
      element.setAttribute('data-reader-join', 'true')
      // A whitespace text node does not change EPUB element indices, and makes
      // copying a selection across the repaired boundary keep its word space.
      if (element.previousSibling?.nodeType !== 3 || !/\s$/u.test(element.previousSibling.textContent)) {
        element.parentNode.insertBefore(doc.createTextNode(' '), element)
      }
      joined = true
    } else joined = false
    previous = element
  }
}
