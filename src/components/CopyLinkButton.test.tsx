import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CopyLinkButton from './CopyLinkButton'

// jsdom has no clipboard API, so stand one up and spy on it.
const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  window.history.pushState({}, '', '/hotels')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CopyLinkButton', () => {
  it('copies the current page URL with the id as its fragment', () => {
    render(<CopyLinkButton id="taj-krishna" label="Taj Krishna Hyderabad" />)

    fireEvent.click(screen.getByRole('button'))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/hotels#taj-krishna`)
  })

  it('tracks the page it was clicked on rather than a fixed path', () => {
    window.history.pushState({}, '', '/travel/tips')
    render(<CopyLinkButton id="what-to-pack" label="What to pack" />)

    fireEvent.click(screen.getByRole('button'))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/travel/tips#what-to-pack`)
  })

  it('keeps the query string, which carries the selected itinerary', () => {
    window.history.pushState({}, '', '/kerala-itinerary?trip=short&flights=ow')
    render(<CopyLinkButton id="pricing" label="Pricing" />)

    fireEvent.click(screen.getByRole('button'))

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/kerala-itinerary?trip=short&flights=ow#pricing`
    )
  })

  it('confirms the copy, then resets itself', () => {
    vi.useFakeTimers()
    render(<CopyLinkButton id="what-to-pack" label="What to pack" />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy link to What to pack')

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Link copied')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy link to What to pack')
  })

  it('does not let the click reach an enclosing toggle', () => {
    // In TravelTips this button sits inside a <summary>, where a click would
    // otherwise open or close the disclosure. Asserted via a parent handler
    // rather than a real <details>, because jsdom does not implement
    // summary-activation toggling — that test would measure jsdom, not us.
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <CopyLinkButton id="what-to-pack" label="What to pack" />
      </div>
    )

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('button'), event)

    expect(onParentClick).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('stays out of the way until hovered or focused', () => {
    render(<CopyLinkButton id="what-to-pack" label="What to pack" />)

    // The reveal is CSS-only; assert the contract the consumers rely on — the
    // button is transparent by default and opts back in via a `group/copy`
    // ancestor's hover or its own focus.
    const className = screen.getByRole('button').className
    expect(className).toContain('opacity-0')
    expect(className).toContain('group-hover/copy:opacity-100')
    expect(className).toContain('focus-visible:opacity-100')
  })
})
