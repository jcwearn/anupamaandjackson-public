import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EArrival from './EArrival'
import Evisa from './Evisa'
import { NAV_ITEMS } from '../lib/navItems'
import { VENUE_ADDRESS } from '../lib/weddingVenue'

beforeAll(() => {
  // StickySectionHeading pins itself with an IntersectionObserver, absent in jsdom.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <EArrival />
    </MemoryRouter>,
  )

describe('EArrival', () => {
  it('copies the dropdown values exactly as the portal spells them', () => {
    renderPage()

    for (const [label, value] of [
      ['Purpose', 'TOURIST'],
      ['State', 'TELANGANA'],
      ['District', 'RANGAREDDI'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: `Copy ${label}` }))
      expect(writeText).toHaveBeenLastCalledWith(value)
    }
  })

  it('gives the same address in India that /evisa gives as the reference', () => {
    // Both pages read the venue from one module; this catches either page
    // going back to a hand-typed copy.
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Copy Address in India' }))
    expect(writeText).toHaveBeenLastCalledWith(VENUE_ADDRESS)

    render(<Evisa />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy Address' }))
    expect(writeText).toHaveBeenLastCalledWith(VENUE_ADDRESS)
  })

  it('says the ISD code is the bare country code, not +1', () => {
    const { container } = renderPage()

    const isd = container.querySelector('#isd-code')!.textContent!
    expect(isd).toMatch(/1 for the U\.S\., not\s+\+1/)
  })

  it('says up front that it can only be filled out a few days ahead', () => {
    // The form's date picker only offers the next few days, so a guest who
    // treats it like the e-Visa and tries weeks early finds nothing to pick.
    const { container } = renderPage()

    expect(container.querySelector('#when-to-fill-it-in')!.textContent).toContain(
      'few days before you fly',
    )
  })

  it('tells guests the emergency contact need not be in India', () => {
    const { container } = renderPage()

    expect(container.querySelector('#emergency-contact')!.textContent).toContain(
      'don’t need to be in India',
    )
  })

  it('sends guests to the official e-Arrival portal', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /official portal/ })).toHaveAttribute(
      'href',
      'https://indianvisaonline.gov.in/earrival/',
    )
  })

  it('stays out of the site nav', () => {
    // Asked for: linked from wherever the e-Arrival card is mentioned, but the
    // nav row is already full.
    expect(NAV_ITEMS.map((item) => item.to)).not.toContain('/e-arrival')
  })
})
