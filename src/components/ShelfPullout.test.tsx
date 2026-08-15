import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, fireEvent } from '@testing-library/react'
import ShelfPullout, { PULL_MS } from './ShelfPullout'
import { books, films } from '../data/shelf'

// jsdom has no requestAnimationFrame; a manual queue lets the closed→open
// switch be observed between frames instead of collapsing synchronously.
const rafQueue: FrameRequestCallback[] = []
const flushFrames = () =>
  act(() => {
    while (rafQueue.length) rafQueue.shift()!(0)
  })

beforeEach(() => {
  rafQueue.length = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  // The scroll lock restores the page position on close; jsdom's scrollTo
  // only shouts "not implemented" into the console.
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  // Unmount before the stubs go: the mount effect's cleanup cancels its frames,
  // and the global afterEach in setup.ts would run after unstubAllGlobals.
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const book = books[0]
const film = films.find((f) => f.externalUrl)!
// A poster that is nowhere near the case's 2:3 — the online short happens to be
// exactly 2:3, so it is the one film whose first frame cannot go wrong.
const croppedFilm = films.find((f) => f.slug === 'kabhi-khushi-kabhie-gham')!

// Where the spine sat on the shelf. Only left/top/height are read.
const shelfRect = { left: 40, top: 300, width: 48, height: 224 } as DOMRect

// The real shelf footprints, for the geometry checks: a book's board is as wide
// as its cover at its shelf height, a film case is a uniform 138 × 207.
const bookBoxRect = { left: 40, top: 300, width: 138, height: 224 } as DOMRect
const caseRect = { left: 40, top: 300, width: 138, height: 207 } as DOMRect

/** The box's first frame on screen: its layout size times the scale it departs at. */
const departureSize = (box: HTMLElement) => {
  const scale = Number(/scale3d\(([\d.]+),/.exec(box.style.transform)![1])
  return {
    width: parseFloat(box.style.width) * scale,
    height: parseFloat(box.style.height) * scale,
  }
}

// The travelling box is the only element carrying a rotateY in its inline
// transform — the PlaceCarousel technique for testing 3D without a renderer.
const travellingBox = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[style]')].find((el) =>
    el.style.transform.includes('rotateY'),
  )!

const reduceMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('ShelfPullout', () => {
  it('starts in the shelf slot and squares up centred once framed', () => {
    const { container } = render(
      <ShelfPullout item={book} fromRect={shelfRect} fromDeg={-26} onClose={() => {}} />,
    )

    // Before any frame: parked on the shelf slot's centre, shrunk to its
    // shelf height, at that shelf position's own resting angle — and seen
    // through the same camera, so the first frame matches the shelf box.
    const box = travellingBox(container)
    expect(box.style.transform).toContain('rotateY(-26deg)')
    expect(box.style.transform).toMatch(/scale3d\(0\./)
    // The camera never moves: scale() precedes perspective() in the list, so
    // the camera always views full-size geometry and 900px matches the shelf.
    expect(box.style.transform).toContain('perspective(900px)')

    flushFrames()

    // After the double-rAF: full size, full camera, the hero display angle.
    expect(box.style.transform).toContain('rotateY(-16deg)')
    expect(box.style.transform).toContain('scale3d(1, 1, 1)')
    expect(box.style.transform).toContain('perspective(900px)')
    expect(box.style.transition).toContain(`${PULL_MS}ms`)
  })

  it('gives films the same travel — every cover already faces the reader', () => {
    const { container } = render(
      <ShelfPullout item={film} fromRect={shelfRect} onClose={() => {}} />,
    )
    flushFrames()

    expect(travellingBox(container).style.transform).toContain('rotateY(-16deg)')
    expect(travellingBox(container).style.transform).toContain('scale3d(1, 1, 1)')
  })

  it('departs at the shelf box footprint, films included', () => {
    // One uniform scale can only land on the shelf rect if the copy carries the
    // shelf box's proportions. Films sit in a uniform 2:3 case with the poster
    // cropped into it, so a copy cut to the poster's own ratio starts up to 6%
    // too wide or too narrow and visibly snaps on the first animated frame.
    const cases = [
      [book, bookBoxRect],
      [croppedFilm, caseRect],
    ] as const

    for (const [item, rect] of cases) {
      const { container, unmount } = render(
        <ShelfPullout item={item} fromRect={rect} onClose={() => {}} />,
      )

      const { width, height } = departureSize(travellingBox(container))
      expect(width).toBeCloseTo(rect.width, 0)
      expect(height).toBeCloseTo(rect.height, 0)
      unmount()
    }
  })

  it('arrives already open when there is no shelf position to travel from', () => {
    // Hash deep links mount this with no rect; there is nothing to animate.
    const { container } = render(<ShelfPullout item={book} fromRect={null} onClose={() => {}} />)

    const box = travellingBox(container)
    expect(box.style.transform).toContain('rotateY(-16deg)')
    expect(box.style.transform).toContain('scale3d(1, 1, 1)')
    expect(box.style.transition).toBe('none')
  })

  it('arrives without travelling under reduced motion', () => {
    reduceMotion()
    const { container } = render(
      <ShelfPullout item={book} fromRect={shelfRect} onClose={() => {}} />,
    )

    const box = travellingBox(container)
    expect(box.style.transform).toContain('rotateY(-16deg)')
    expect(box.style.transform).toContain('scale3d(1, 1, 1)')
    expect(box.style.transition).toBe('none')
  })

  it('shows the detail panel with a safe YouTube link for the one online item', () => {
    const { container, getByRole } = render(
      <ShelfPullout item={film} fromRect={null} onClose={() => {}} />,
    )

    expect(getByRole('dialog')).toHaveAccessibleName(film.title)
    expect(container.textContent).toContain(film.creator)
    expect(container.textContent).toContain(String(film.year))
    expect(container.textContent).toContain(film.genre)
    expect(container.textContent).toContain(film.teaser)

    const link = container.querySelector(`a[href="${film.externalUrl}"]`)!
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('sends a book to Goodreads, with its page count alongside the year', () => {
    const { container } = render(<ShelfPullout item={book} fromRect={null} onClose={() => {}} />)

    expect(container.textContent).toContain(`${book.pages!.toLocaleString()} pages`)
    const link = container.querySelector(`a[href="${book.libraryUrl}"]`)!
    expect(link.textContent).toBe('View on Goodreads')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('sends a film to Letterboxd, with no page count to report', () => {
    const { container } = render(
      <ShelfPullout item={croppedFilm} fromRect={null} onClose={() => {}} />,
    )

    expect(container.textContent).not.toContain('pages')
    const link = container.querySelector(`a[href="${croppedFilm.libraryUrl}"]`)!
    expect(link.textContent).toBe('View on Letterboxd')
  })

  it('decodes the travelling cover synchronously, with no alt to flash', () => {
    // A fresh img paints before its async decode finishes, so the first-ever
    // pull showed one frame of alt text where the cover should be.
    const { container } = render(
      <ShelfPullout item={book} fromRect={shelfRect} onClose={() => {}} />,
    )

    const img = travellingBox(container).querySelector('img')!
    expect(img.getAttribute('decoding')).toBe('sync')
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('alt')).toBe('')
  })

  it('plays the pull back in before unmounting', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { container, getByRole } = render(
      <ShelfPullout item={book} fromRect={shelfRect} onClose={onClose} />,
    )
    flushFrames()

    fireEvent.click(getByRole('button', { name: 'Close' }))

    // Headed back to its slot, but still mounted until the travel ends.
    expect(travellingBox(container).style.transform).toContain('rotateY(-20deg)')
    expect(onClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(PULL_MS)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and on the backdrop, immediately when nothing animates', () => {
    const onClose = vi.fn()
    const { container, unmount } = render(
      <ShelfPullout item={book} fromRect={null} onClose={onClose} />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(container.querySelector('[aria-hidden="true"]')!)
    expect(onClose).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('pins the page while open and restores it after', () => {
    // position:fixed, not overflow:hidden — iOS ignores the overflow trick
    // and scrolls the page under the overlay, drifting the backdrop.
    const { unmount } = render(<ShelfPullout item={book} fromRect={null} onClose={() => {}} />)
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')
    // Instant, or globals.css's smooth scroll-behavior animates the restore
    // from the top of the page.
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })
})
