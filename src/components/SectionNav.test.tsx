import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SectionNav from './SectionNav'
import { TRAVEL_NAV_ITEMS } from '../lib/navItems'
import { JUMP_NAV_HEIGHT_PX } from '../lib/constants'

// The bar suppresses hiding for a moment after mount, so a deep link's landing
// scroll doesn't read as the reader setting off. These tests drive that clock
// rather than waiting on it.
let clock = 0

beforeAll(() => {
  vi.stubGlobal('performance', { now: () => clock })
  // The scroll listener is rAF-throttled; run the callback inline so a
  // dispatched scroll event settles within the act() that sent it.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

// scrollY is global and survives between tests, and the hook reads it once on
// mount to know where the reader started.
beforeEach(() => {
  clock = 0
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})

const scrollNow = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

// Past the settle window, so this reads as the reader rather than an arrival.
const scrollTo = (y: number) => {
  clock += 1000
  scrollNow(y)
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SectionNav items={TRAVEL_NAV_ITEMS} label="Travel section" />
    </MemoryRouter>,
  )

const current = () =>
  screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.getAttribute('href'))

describe('SectionNav', () => {
  it('renders every item as a link', () => {
    renderAt('/travel')

    for (const item of TRAVEL_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.to)
    }
  })

  // Without `end` on the section root, /travel would also match its children and
  // two chips would read as current at once.
  it('marks exactly the current page, on the root and on a sub-page', () => {
    renderAt('/travel')
    expect(current()).toEqual(['/travel'])
  })

  it('marks only the sub-page when one is open', () => {
    renderAt('/travel/hyderabad')
    expect(current()).toEqual(['/travel/hyderabad'])
  })

  it('leaves the current chip inert under the pointer', () => {
    // The hover cue on an active chip means "press me again and something
    // happens". Here it would be a lie: the chip you are on is the page you
    // are on. /admin/guest-summary's filter chips opt into it because pressing
    // one of those releases the filter.
    renderAt('/travel/tips')

    const [chip] = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')

    expect(chip.className).toContain('bg-rosewood')
    expect(chip.className).not.toContain('hover:bg-')
  })

  it('is labelled for screen readers, so it is distinct from the site nav', () => {
    renderAt('/travel')
    expect(screen.getByRole('navigation', { name: 'Travel section' })).toBeInTheDocument()
  })

  it('gets out of the way on the way down the page, and comes back on the way up', () => {
    const { container } = renderAt('/travel')
    const bar = () => container.querySelector('nav')!

    expect(bar().className).not.toContain('-translate-y-full')

    scrollTo(600)
    expect(bar().className, 'should hide scrolling down').toContain('-translate-y-full')
    expect(bar()).toHaveAttribute('inert')

    scrollTo(400)
    expect(bar().className, 'should return scrolling up').not.toContain('-translate-y-full')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('stays until the page has scrolled by its own height', () => {
    // It sits at the very top of the page, so before then it is covering page
    // background rather than content: sliding away just opens a pale gap under
    // SiteNav where the bar used to be.
    const { container } = renderAt('/travel')
    const bar = () => container.querySelector('nav')!

    scrollTo(JUMP_NAV_HEIGHT_PX - 1)
    expect(bar().className, 'too early to hide').not.toContain('-translate-y-full')

    scrollTo(JUMP_NAV_HEIGHT_PX + 20)
    expect(bar().className, 'clear of its own slot now').toContain('-translate-y-full')
  })

  it('stays for a deep link’s own landing scroll', () => {
    // Following /travel/tips#what-to-pack scrolls a long way down, which would
    // otherwise read as the reader setting off and take the bar away at the one
    // moment they most need to see where they've landed.
    const { container } = renderAt('/travel/tips')

    scrollNow(600)

    expect(container.querySelector('nav')!.className).not.toContain('-translate-y-full')
  })
})
