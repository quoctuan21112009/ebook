import { PageFlip } from 'page-flip'

// StPageFlip 2.0.7 does not stop its RAF loop in destroy(). Own that loop so
// opening another chapter or changing type size releases the previous book.
export function mountPageFlip(root, settings, elements) {
  const flip = new PageFlip(root, settings)
  const request = window.requestAnimationFrame.bind(window)
  const cancel = window.cancelAnimationFrame.bind(window)
  const initialFrames = []
  const previousRequest = window.requestAnimationFrame
  window.requestAnimationFrame = callback => {
    const id = request(callback)
    initialFrames.push(id)
    return id
  }
  try { flip.loadFromHTML(elements) }
  finally {
    window.requestAnimationFrame = previousRequest
    initialFrames.forEach(cancel)
  }
  let frame, disposed = false
  const render = flip.getRender()
  const tick = time => {
    if (disposed) return
    render.render(time)
    frame = request(tick)
  }
  frame = request(tick)
  return {
    flip,
    destroy() {
      disposed = true
      cancel(frame)
      // 2.0.7 also skips the resize listener cleanup when selection mode
      // disables mouse events; removeEventListener is safe for absent handlers.
      flip.getSettings().useMouseEvents = true
      flip.destroy()
    },
  }
}
