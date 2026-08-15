import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import JumpNav from './JumpNav'
import { JUMP_NAV_SCROLL_MT, type JumpTarget } from './JumpNav'
import { JumpNavOffset } from '../lib/jumpNavOffset'
import {
  JUMP_NAV_HEIGHT_PX,
  JUMP_NAV_SECTION_TOP,
  SITE_NAV_HEIGHT_PX,
  SITE_NAV_OFFSET,
} from '../lib/constants'

// The bar suppresses hiding for a moment after mount, so a deep link's landing
// scroll doesn't read as the reader setting off. These tests drive that clock
// rather than waiting on it.
let clock = 0

beforeAll(() => {
  vi.stubGlobal('performance', { now: () => clock })
  // The scroll listeners are rAF-throttled; run the callback inline so a
  // dispatched scroll event settles within the act() that sent it.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})

  // The bar itself doesn't use one, but pages that mount it render
  // StickySectionHeading alongside, which does. jsdom has neither.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const targets: JumpTarget[] = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
]

// window.scrollY is global and survives between tests, and the hook reads it
// once on mount to know where the reader started — so a leftover value makes the
// next test's first scroll look like no movement at all.
beforeEach(() => {
  clock = 0
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})

// The bar reacts to scroll direction, and jsdom never scrolls on its own.
// scrollY is a getter there, so it has to be redefined rather than assigned.
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

// Stands in for a StickySectionHeading: all a heading takes from the bar is
// where to pin, so reading the context directly tests that without dragging the
// heading's own behaviour into these cases.
const OffsetProbe = () => {
  const { top, pinPx } = React.useContext(JumpNavOffset)
  return <div data-probe data-top={top} data-pin={pinPx} />
}

const page = () => (
  <JumpNav targets={targets}>
    <div>
      <OffsetProbe />
      {targets.map((target) => (
        <section key={target.id} id={target.id} className={JUMP_NAV_SCROLL_MT}>
          {target.label} content
        </section>
      ))}
    </div>
  </JumpNav>
)

describe('JumpNav', () => {
  it('renders a chip per target, each pointing at a section that exists', () => {
    // The chips, the section ids and the headings' anchorIds are written out
    // separately by each page, so they can drift apart silently.
    const { container } = render(page())

    for (const target of targets) {
      const chip = screen.getByRole('link', { name: target.label })
      expect(chip).toHaveAttribute('href', `#${target.id}`)
      expect(container.querySelector(`#${target.id}`), `no section ${target.id}`).not.toBeNull()
    }
  })

  it('leaves no trailing blank screen for readers who just scroll', () => {
    const { container } = render(page())

    expect(container.querySelector('[data-jump-room]')).toBeNull()
  })

  it('opens up room on a jump, so the target can reach the top', () => {
    // Without this the page runs out of scroll before the last section gets
    // there, and the highlight sticks on whichever one did.
    const { container } = render(page())

    fireEvent.click(screen.getByRole('link', { name: 'Last' }))

    expect(container.querySelector('[data-jump-room]')).not.toBeNull()
  })

  it('sizes the room to the shortfall rather than a flat screenful', () => {
    // Anything more is blank page the reader can fall into; anything less and
    // the target still can't reach the line.
    const { container } = render(page())

    fireEvent.click(screen.getByRole('link', { name: 'Last' }))

    // jsdom lays nothing out, so the last section measures 0 and the shortfall
    // is the whole viewport below the two bars.
    const spacer = container.querySelector('[data-jump-room]') as HTMLElement
    expect(spacer.style.height).toBe(`${window.innerHeight - 128}px`)
  })

  it('marks exactly one chip as the section in view', () => {
    // Which one is a question of layout, and jsdom has none — every section
    // measures 0 — so that part is verified in a real browser. What's worth
    // pinning here is that the bar never claims to be in two places at once.
    const { container } = render(page())

    expect(container.querySelectorAll('nav a[aria-current]')).toHaveLength(1)
  })

  it('gets out of the way on the way down the page, and comes back on the way up', () => {
    // 48px is worth paying to navigate and not to read. Three bars pinned at
    // once was a third of a small phone's screen.
    const { container } = render(page())
    const bar = () => container.querySelector('nav')!

    expect(bar().className).not.toContain('-translate-y-full')

    scrollTo(600)
    expect(bar().className, 'should hide scrolling down').toContain('-translate-y-full')

    scrollTo(400)
    expect(bar().className, 'should return scrolling up').not.toContain('-translate-y-full')
  })

  it('stays put for jitter too small to be a deliberate scroll', () => {
    const { container } = render(page())

    scrollTo(4)

    expect(container.querySelector('nav')!.className).not.toContain('-translate-y-full')
  })

  it('hands its slot to the headings when it goes, and takes it back when it returns', () => {
    // Without this the headings stay pinned 48px lower than the bar they were
    // clearing, and a strip of content scrolls through the space it left.
    const { container } = render(page())
    const probe = () => container.querySelector('[data-probe]') as HTMLElement

    expect(probe().dataset.top).toBe(JUMP_NAV_SECTION_TOP)
    expect(probe().dataset.pin).toBe(String(SITE_NAV_HEIGHT_PX + JUMP_NAV_HEIGHT_PX))

    scrollTo(600)
    expect(probe().dataset.top, 'headings should move up into the bar’s slot').toBe(SITE_NAV_OFFSET)
    expect(probe().dataset.pin).toBe(String(SITE_NAV_HEIGHT_PX))

    scrollTo(400)
    expect(probe().dataset.top, 'and back down when it returns').toBe(JUMP_NAV_SECTION_TOP)
  })

  it('brings the bar back before jumping, so the target lands where scroll-mt expects', () => {
    // scroll-mt on each section clears both bars. Jump while the headings are
    // pinned in the bar's slot and every target lands 48px out.
    const { container } = render(page())

    scrollTo(600)
    expect(container.querySelector('nav')!.className).toContain('-translate-y-full')

    fireEvent.click(screen.getByRole('link', { name: 'Last' }))

    expect(container.querySelector('nav')!.className).not.toContain('-translate-y-full')
    expect((container.querySelector('[data-probe]') as HTMLElement).dataset.top).toBe(
      JUMP_NAV_SECTION_TOP,
    )
  })

  // Not covered here: the room surviving a second jump once the first has come
  // to rest. Retraction depends on document scrollHeight, which jsdom reports as
  // 0, and on rAF timing that the synchronous stub above collapses — a test
  // would pass whether or not the code works. Verified in a browser instead.

  it('takes itself out of the tab order while hidden', () => {
    // Otherwise the chips are focusable off screen, and tabbing scrolls to
    // nothing the reader can see.
    const { container } = render(page())

    scrollTo(600)

    expect(container.querySelector('nav')).toHaveAttribute('inert')
  })

  it('labels the bar for anyone navigating by landmark', () => {
    render(page())

    expect(screen.getByRole('navigation', { name: 'Jump to section' })).toBeInTheDocument()
  })
})
