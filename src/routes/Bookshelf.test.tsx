import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import Bookshelf from './Bookshelf'
import { shelfItems, books } from '../data/shelf'
import { NAV_ITEMS } from '../lib/navItems'

beforeAll(() => {
  // The pull-out opens on the frame after mount; jsdom implements neither rAF
  // nor its cancel.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  // The pull-out's scroll lock calls this on close; jsdom's version only
  // shouts "not implemented" into the console.
  vi.stubGlobal('scrollTo', vi.fn())
})

beforeEach(() => {
  // Hash state leaks between tests otherwise — the mount effect reads it.
  window.history.replaceState(null, '', '/bookshelf')
})

const shelfButton = (container: HTMLElement, title: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label^="${title}"]`)

describe('the shelves', () => {
  it('ships every title in the DOM, both panels at once', () => {
    // The page is prerendered; the hidden Movies panel still has to carry its
    // items for search and pre-hydration readers.
    const { container } = render(<Bookshelf />)

    for (const item of shelfItems) {
      expect(shelfButton(container, item.title), `no shelf button for ${item.title}`).not.toBeNull()
    }
  })

  it('sizes each book from its physical dimensions', () => {
    const { container } = render(<Bookshelf />)

    for (const book of books) {
      const button = shelfButton(container, book.title)!
      // Height comes straight from the data; width follows the cover's aspect
      // ratio, so only its derivation is pinned here.
      expect(button.style.height).toBe(`${book.spine!.heightPx}px`)
      expect(button.style.width).toBe(
        `${Math.round((book.spine!.heightPx * book.cover.width) / book.cover.height)}px`,
      )
    }
  })

  it('shows every cover face-out with its title in the alt text', () => {
    const { container } = render(<Bookshelf />)

    for (const item of shelfItems) {
      const button = shelfButton(container, item.title)!
      expect(button.querySelector(`img[alt="${item.cover.alt}"]`)).not.toBeNull()
    }
  })
})

describe('responsive shelving', () => {
  it('trades columns for rows on narrow screens instead of scrolling', () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 380 })
    try {
      const { container } = render(<Bookshelf />)
      // Eight books at two across make four bays, each its own row.
      expect(container.querySelectorAll('#shelf-panel-books [class*="overflow-x-"]')).toHaveLength(
        4,
      )
      // Eight films at two across make four.
      expect(container.querySelectorAll('#shelf-panel-movies [class*="overflow-x-"]')).toHaveLength(
        4,
      )
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: original })
    }
  })
})

describe('the Books / Movies toggle', () => {
  it('opens on Books with Movies waiting behind a real tablist', () => {
    render(<Bookshelf />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Books', 'Movies & Media'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(document.getElementById('shelf-panel-books')).not.toHaveAttribute('hidden')
    expect(document.getElementById('shelf-panel-movies')).toHaveAttribute('hidden')
  })

  it('swaps the visible shelf when Movies is chosen', () => {
    render(<Bookshelf />)

    fireEvent.click(screen.getByRole('tab', { name: 'Movies & Media' }))

    expect(document.getElementById('shelf-panel-books')).toHaveAttribute('hidden')
    expect(document.getElementById('shelf-panel-movies')).not.toHaveAttribute('hidden')
  })
})

describe('pulling an item off the shelf', () => {
  it('opens the detail dialog, writes the fragment, and empties the slot', () => {
    const { container } = render(<Bookshelf />)
    const first = books[0]

    fireEvent.click(shelfButton(container, first.title)!)

    expect(screen.getByRole('dialog', { name: first.title })).toBeInTheDocument()
    expect(window.location.hash).toBe(`#${first.slug}`)
    // The overlay owns the book now; its shelf slot stays open behind it.
    expect(shelfButton(container, first.title)!.style.visibility).toBe('hidden')
  })

  it('drops the spotlight the moment the overlay takes the item', () => {
    // The real bug this guards: pointerleave never fires once the button is
    // hidden, so the hover glow survived the pull-out and relit next to a
    // newly hovered neighbour — two items under the spotlight at once.
    const { container } = render(<Bookshelf />)
    const button = shelfButton(container, books[0].title)!
    // The ring's gold shadow is painted constantly; opacity is what the
    // spotlight toggles (animating box-shadow flashed compositing seams).
    const glowing = () =>
      [...button.querySelectorAll('span')].some(
        (s) => s.style.boxShadow.includes('200, 162, 94') && s.style.opacity === '1',
      )

    fireEvent.pointerEnter(button)
    expect(glowing()).toBe(true)

    fireEvent.click(button)
    expect(glowing()).toBe(false)
  })

  it('opens straight from a deep link, on the right shelf', () => {
    window.history.replaceState(null, '', '/bookshelf#rrr')
    render(<Bookshelf />)

    expect(document.getElementById('shelf-panel-movies')).not.toHaveAttribute('hidden')
    expect(screen.getByRole('dialog', { name: 'RRR' })).toBeInTheDocument()
  })

  it('clears the fragment when the book goes back on the shelf', () => {
    window.history.replaceState(null, '', '/bookshelf#rrr')
    render(<Bookshelf />)

    // A hash-opened item has no shelf position, so closing is immediate.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('selects a shelf from the #books and #movies fragments', () => {
    window.history.replaceState(null, '', '/bookshelf#movies')
    render(<Bookshelf />)

    expect(document.getElementById('shelf-panel-movies')).not.toHaveAttribute('hidden')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('navigation', () => {
  it('is reachable from the site nav', () => {
    expect(NAV_ITEMS).toContainEqual({ to: '/bookshelf', label: 'Bookshelf' })
  })
})
