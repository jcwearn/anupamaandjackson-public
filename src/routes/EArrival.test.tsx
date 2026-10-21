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

    render(
      <MemoryRouter>
        <Evisa />
      </MemoryRouter>,
    )
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

  it('tells guests a connection is not a country visited', () => {
    const { container } = renderPage()

    const visited = container.querySelector('#countries-visited')!.textContent!
    expect(visited).toContain('No Country Visited')
    expect(visited).toMatch(/connection .* doesn’t count/)
  })

  it('recommends Chrome for submitting the form', () => {
    // The portal's submit request fails in Firefox with nothing on screen.
    const { container } = renderPage()

    const note = container.querySelector('#use-chrome')!.textContent!
    expect(note).toContain('recommend using Chrome')
    expect(note).toContain('Other browsers can have trouble')
  })

  it('prepares guests for the pause, the pop-up and the download', () => {
    const { container } = renderPage()

    const after = container.querySelector('#after-you-submit')!.textContent!
    expect(after).toContain('don’t press Submit again')
    expect(after).toContain('Arrival Card generated successfully')
    expect(after).toContain('downloads the card(s)')
  })

  it('doesn’t ask guests to keep the pop-up’s card numbers', () => {
    // Nothing later asks for them; the downloaded card is what they carry.
    const { container } = renderPage()

    const after = container.querySelector('#after-you-submit')!.textContent!
    expect(after).not.toMatch(/jot|screenshot|note your/i)
  })

  it('sends guests to the official e-Arrival portal', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /official portal/ })).toHaveAttribute(
      'href',
      'https://indianvisaonline.gov.in/earrival/',
    )
  })

  it('points to the Air Suvidha health declaration, due the same week', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /Air Suvidha/ })).toHaveAttribute(
      'href',
      'https://airsuvidha.civilaviation.gov.in/',
    )
  })

  it('shows the submit steps before sending a click on to the portal', () => {
    // Guests heading for the portal click past the card under the button, so
    // the button repeats it in a modal instead of navigating.
    renderPage()

    const button = screen.getByRole('link', { name: /official portal/ })
    expect(fireEvent.click(button)).toBe(false)
    expect(screen.getByRole('dialog', { name: /What happens when you submit/ })).toHaveTextContent(
      'don’t press Submit again',
    )
  })

  it('morphs the card into the modal inside a view transition', () => {
    // The card hands its view-transition name to the modal, so the browser
    // animates one into the other; the card stays behind as a gap.
    const startViewTransition = vi.fn((update: () => void) => update())
    Object.assign(document, { startViewTransition })
    const { container } = renderPage()
    const card = container.querySelector<HTMLElement>('#after-you-submit')!
    expect(card.style.viewTransitionName).toBe('submit-steps')

    fireEvent.click(screen.getByRole('link', { name: /official portal/ }))

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(card.style.viewTransitionName).toBe('')
    expect(card.style.visibility).toBe('hidden')
    expect(screen.getByRole('dialog').style.viewTransitionName).toBe('submit-steps')

    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    expect(startViewTransition).toHaveBeenCalledTimes(2)
    expect(card.style.viewTransitionName).toBe('submit-steps')
    delete (document as { startViewTransition?: unknown }).startViewTransition
  })

  it('lets a cmd-click go straight to the portal', () => {
    renderPage()

    const button = screen.getByRole('link', { name: /official portal/ })
    expect(fireEvent.click(button, { metaKey: true })).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays out of the site nav', () => {
    // Asked for: linked from wherever the e-Arrival card is mentioned, but the
    // nav row is already full.
    expect(NAV_ITEMS.map((item) => item.to)).not.toContain('/e-arrival')
  })
})
