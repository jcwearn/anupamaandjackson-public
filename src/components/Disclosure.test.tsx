import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Bullets, Disclosure, DisclosureGroup } from './Disclosure'

describe('Disclosure', () => {
  it('renders its title and body under the given id', () => {
    const { container } = render(
      <Disclosure id="kids-welcome" title="Are kids welcome?">
        <p>Of course!</p>
      </Disclosure>,
    )

    const details = container.querySelector('details#kids-welcome')
    expect(details).not.toBeNull()
    expect(within(details as HTMLElement).getByText('Are kids welcome?')).toBeInTheDocument()
    expect(within(details as HTMLElement).getByText('Of course!')).toBeInTheDocument()
  })

  it('offers a copy-link button labelled from its title', () => {
    render(
      <Disclosure id="kids-welcome" title="Are kids welcome?">
        <p>Of course!</p>
      </Disclosure>,
    )

    expect(
      screen.getByRole('button', { name: 'Copy link to Are kids welcome?' }),
    ).toBeInTheDocument()
  })
})

describe('DisclosureGroup', () => {
  it('renders its title, blurb and children', () => {
    const { container } = render(
      <DisclosureGroup id="rsvp-and-guests" title="RSVP & Guests" blurb="Who’s coming.">
        <Disclosure id="bring-a-date" title="Can I bring a date?">
          <p>Check your invite.</p>
        </Disclosure>
      </DisclosureGroup>,
    )

    expect(screen.getByText('RSVP & Guests')).toBeInTheDocument()
    expect(screen.getByText('Who’s coming.')).toBeInTheDocument()
    // Nested, so a deep link has two disclosures to open on the way down.
    expect(container.querySelector('details#rsvp-and-guests details#bring-a-date')).not.toBeNull()
  })

  it('offers a copy-link button labelled from its title', () => {
    render(
      <DisclosureGroup id="rsvp-and-guests" title="RSVP & Guests" blurb="Who’s coming.">
        <p>…</p>
      </DisclosureGroup>,
    )

    expect(screen.getByRole('button', { name: 'Copy link to RSVP & Guests' })).toBeInTheDocument()
  })
})

describe('Bullets', () => {
  it('renders one list item per entry', () => {
    render(<Bullets items={['One', 'Two', <span key="three">Three</span>]} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
