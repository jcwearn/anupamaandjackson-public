import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RsvpModal from './RsvpModal'
import { WITHJOY_HOMEPAGE_URL, WITHJOY_RSVP_URL } from '../lib/constants'

const noop = () => {}

describe('RsvpModal', () => {
  it('sends guests to Joy’s homepage by default', () => {
    // The default keeps the call sites that predate the href prop — Landing and
    // Invite — pointed exactly where they were.
    render(<RsvpModal open onClose={noop} />)

    expect(screen.getByRole('link', { name: /RSVP/ })).toHaveAttribute('href', WITHJOY_HOMEPAGE_URL)
  })

  it('sends them to the RSVP form when given one', () => {
    render(<RsvpModal open onClose={noop} href={WITHJOY_RSVP_URL} />)

    expect(screen.getByRole('link', { name: /RSVP/ })).toHaveAttribute('href', WITHJOY_RSVP_URL)
  })

  it('points the RSVP url at the form rather than the homepage', () => {
    expect(WITHJOY_RSVP_URL).toMatch(/\/rsvp$/)
    expect(WITHJOY_RSVP_URL).not.toBe(WITHJOY_HOMEPAGE_URL)
  })

  it('opens the CTA in a new tab without leaking the opener', () => {
    render(<RsvpModal open onClose={noop} href={WITHJOY_RSVP_URL} />)

    const cta = screen.getByRole('link', { name: /RSVP/ })
    expect(cta).toHaveAttribute('target', '_blank')
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows the password guests need to get past Joy’s gate', () => {
    render(<RsvpModal open onClose={noop} />)

    expect(screen.getByText('mangopickle')).toBeInTheDocument()
  })
})
