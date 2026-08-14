import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import StickySectionHeading from './StickySectionHeading'
import { JumpNavOffset } from './JumpNav'
import { JUMP_NAV_SECTION_TOP } from '../lib/constants'

beforeAll(() => {
  // The component pins itself using an IntersectionObserver, which jsdom
  // doesn't implement. Nothing here depends on it firing.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

describe('StickySectionHeading', () => {
  it('renders no copy button when no anchorId is given', () => {
    // A copy button on a section with no id would link to nothing.
    render(<StickySectionHeading eyebrow="Day 1 · Thursday, October 29" title="Arrive in Kochi" />)

    expect(screen.getByRole('heading', { name: 'Arrive in Kochi' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders no copy button when the title is the only prop', () => {
    render(<StickySectionHeading title="Inclusions" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pins under SiteNav by default', () => {
    const { container } = render(<StickySectionHeading title="Inclusions" />)

    expect(container.querySelector('.sticky')).toHaveStyle({
      top: 'calc(env(safe-area-inset-top, 0px) + 5rem)',
    })
  })

  it('pins below a jump bar when one is above it', () => {
    // Hotels stacks a JumpNav under SiteNav; its headings go below both rather
    // than sliding underneath the bar. The offset arrives by context because it
    // moves as that bar hides and returns.
    const { container } = render(
      <JumpNavOffset.Provider value={{ top: JUMP_NAV_SECTION_TOP, pinPx: 128 }}>
        <StickySectionHeading title="Wedding Hotels" />
      </JumpNavOffset.Provider>
    )

    expect(container.querySelector('.sticky')).toHaveStyle({ top: JUMP_NAV_SECTION_TOP })
  })

  it('takes a whole element as the eyebrow, not just a string', () => {
    // The schedule's day venue goes here, and it is a map link — the other
    // pages pass plain strings, which must keep working.
    render(
      <StickySectionHeading
        eyebrow={<a href="https://maps.app.goo.gl/SpZipKNxsgTZEywSA">Golkonda Resorts and Spa</a>}
        title="Wednesday, October 28"
      />
    )

    expect(screen.getByRole('link', { name: 'Golkonda Resorts and Spa' })).toHaveAttribute(
      'href',
      'https://maps.app.goo.gl/SpZipKNxsgTZEywSA'
    )
  })

  it('renders no eyebrow line when there is none to render', () => {
    // An empty paragraph would still take up room in a bar that pins over the
    // page.
    const { container } = render(<StickySectionHeading title="Inclusions" />)

    expect(container.querySelector('p')).toBeNull()
  })

  it('renders a copy button for the anchor when anchorId is given', () => {
    render(
      <StickySectionHeading
        eyebrow="Banjara Hills · October 26"
        title="Pre-Wedding Hotels"
        anchorId="pre-wedding-hotels"
      />
    )

    expect(
      screen.getByRole('button', { name: 'Copy link to Pre-Wedding Hotels' })
    ).toBeInTheDocument()
  })
})
