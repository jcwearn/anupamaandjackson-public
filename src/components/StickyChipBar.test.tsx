import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import StickyChipBar from './StickyChipBar'
import { useHiddenOnScrollDown } from '../lib/useHiddenOnScrollDown'
import { JUMP_NAV_HEIGHT_PX, SITE_NAV_OFFSET } from '../lib/constants'

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

// The bar on its own, driven by the `hidden` prop rather than by scrolling — for
// the things that are true of its markup whatever the reader is doing.
const renderBar = (hidden = false) =>
  render(
    <StickyChipBar label="Travel section" hidden={hidden}>
      <a href="/one">One</a>
      <a href="/two">Two</a>
    </StickyChipBar>,
  )

// The hook and the bar are one unit in practice — both callers pipe `hidden`
// straight through — so this stands in for a caller. The other two values the
// hook returns sit behind buttons *outside* the bar, so they stay clickable
// while it's inert.
const Harness = () => {
  const [hidden, setHidden, settle] = useHiddenOnScrollDown()
  return (
    <>
      <StickyChipBar label="Jump to section" hidden={hidden}>
        <a href="#first">First</a>
      </StickyChipBar>
      <button onClick={() => setHidden(false)}>show</button>
      <button onClick={settle}>settle</button>
    </>
  )
}

const setup = () => {
  const { container } = render(<Harness />)
  return () => container.querySelector('nav')!
}

describe('StickyChipBar', () => {
  it('is a labelled nav holding its chips', () => {
    renderBar()

    const bar = screen.getByRole('navigation', { name: 'Travel section' })
    expect(bar).toContainElement(screen.getByRole('link', { name: 'One' }))
    expect(bar).toContainElement(screen.getByRole('link', { name: 'Two' }))
  })

  it('leaves the tab order while it is off screen', () => {
    const { container } = renderBar(true)
    const bar = container.querySelector('nav')!

    expect(bar.className).toContain('-translate-y-full')
    expect(bar).toHaveAttribute('inert')
  })

  it('keeps the chips in a centring row inside a horizontal scroller', () => {
    // jsdom has no layout, so it cannot see the overflow this exists to survive:
    // four Travel chips measure 49px wider than a 320px screen. What it can hold
    // is the structure that makes the overflow reachable — the scroll container
    // has to be the nav, and the chips have to sit in an mx-auto row inside it.
    // Centring the scroller itself instead would push the overflow half off each
    // end and put the first chip out of reach.
    const { container } = renderBar()
    const bar = container.querySelector('nav')!
    const row = bar.firstElementChild!

    expect(bar.className).toContain('overflow-x-auto')
    // One axis scrolling computes the other to `auto`; a vertical scrollbar in a
    // 48px bar is worse than the clipping it would be there to solve.
    expect(bar.className).toContain('overflow-y-hidden')
    expect(bar.className).not.toContain('justify-center')

    expect(row.className).toContain('mx-auto')
    expect(row).toContainElement(screen.getByRole('link', { name: 'One' }))
  })

  it('pins directly under SiteNav', () => {
    // Its whole reason for existing is to sit in that slot; anywhere else and
    // it either hides behind SiteNav or leaves a strip of page showing through.
    const bar = setup()

    expect(bar().className).toContain('sticky')
    // Compared through a throwaway element rather than against the constant
    // directly: jsdom's CSS parser rewrites the calc() into a form it can't
    // round-trip, so both sides have to come out of the same mangle.
    const reference = document.createElement('div')
    reference.style.top = SITE_NAV_OFFSET
    expect(bar().getAttribute('style')).toContain(`top: ${reference.style.top}`)
  })

  it('renders the chips it was handed', () => {
    setup()

    expect(screen.getByRole('link', { name: 'First' })).toHaveAttribute('href', '#first')
  })

  it('is labelled for screen readers, so it is distinct from the site nav', () => {
    setup()

    expect(screen.getByRole('navigation', { name: 'Jump to section' })).toBeInTheDocument()
  })

  it('gets out of the way on the way down the page, and comes back on the way up', () => {
    // 48px is worth paying to navigate and not to read.
    const bar = setup()

    expect(bar().className).not.toContain('-translate-y-full')

    scrollTo(600)
    expect(bar().className, 'should hide scrolling down').toContain('-translate-y-full')
    expect(bar(), 'should not be focusable off screen').toHaveAttribute('inert')

    scrollTo(400)
    expect(bar().className, 'should return scrolling up').not.toContain('-translate-y-full')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('stays until the page has scrolled by its own height', () => {
    // It sits at the very top of the page, so before then it is covering page
    // background rather than content: sliding away just opens a pale gap under
    // SiteNav where the bar used to be.
    const bar = setup()

    scrollTo(JUMP_NAV_HEIGHT_PX - 1)
    expect(bar().className, 'too early to hide').not.toContain('-translate-y-full')

    scrollTo(JUMP_NAV_HEIGHT_PX + 20)
    expect(bar().className, 'clear of its own slot now').toContain('-translate-y-full')
  })

  it('does not flicker back on a trackpad’s jitter', () => {
    // A few px of drift the wrong way is not the reader turning round, and
    // acting on it strobes the bar in and out under their thumb.
    const bar = setup()

    scrollTo(600)
    expect(bar().className).toContain('-translate-y-full')

    scrollTo(594)

    expect(bar().className, 'six pixels is not a change of direction').toContain(
      '-translate-y-full',
    )
  })

  it('sits still for the scroll that lands a deep link, then behaves normally', () => {
    // Following a link with a hash scrolls a long way down on its own, which
    // would otherwise take the bar away at the one moment the reader most needs
    // to see where they've arrived.
    const bar = setup()

    scrollNow(600)
    expect(bar().className, 'that scroll was the arrival, not the reader').not.toContain(
      '-translate-y-full',
    )

    scrollTo(1200)
    expect(bar().className, 'but the next one is the reader').toContain('-translate-y-full')
  })

  it('re-opens that window on request, for a jump that lands long after mount', () => {
    // JumpNav's deep-link landing waits for `load`, which can fire well past the
    // window opened at mount. Without this its own scroll reads as the reader.
    const bar = setup()

    scrollTo(600)
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    fireEvent.click(screen.getByRole('button', { name: 'settle' }))

    clock += 100
    scrollNow(1200)
    expect(bar().className, 'still inside the fresh window').not.toContain('-translate-y-full')

    scrollTo(1800)
    expect(bar().className, 'and out the other side of it').toContain('-translate-y-full')
  })

  it('comes back when a caller asks, so a jump can be aimed at the right line', () => {
    // Sections' scroll-mt clears both bars. Jump while this one is away and
    // every target lands 48px out, so JumpNav brings it in before it jumps.
    const bar = setup()

    scrollTo(600)
    expect(bar().className).toContain('-translate-y-full')

    fireEvent.click(screen.getByRole('button', { name: 'show' }))

    expect(bar().className).not.toContain('-translate-y-full')
  })
})
