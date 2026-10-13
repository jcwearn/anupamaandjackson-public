import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminIndex from './AdminIndex'

describe('AdminIndex', () => {
  it('links each tool to its page in Wedding HQ', () => {
    render(<AdminIndex />)

    expect(screen.getByRole('link', { name: /Invite Links/ })).toHaveAttribute(
      'href',
      'https://hq.anupamaandjackson.com/invite-links',
    )
    expect(screen.getByRole('link', { name: /Guest Summary/ })).toHaveAttribute(
      'href',
      'https://hq.anupamaandjackson.com/guests',
    )
    expect(screen.getByRole('link', { name: /Kerala Trip/ })).toHaveAttribute(
      'href',
      'https://hq.anupamaandjackson.com/kerala',
    )
  })

  it('says what each tool is for', () => {
    // The whole reason for an index rather than a bare list of links: these are
    // used rarely enough that "Invite Links" alone does not say which is which.
    render(<AdminIndex />)

    expect(
      screen.getByText('Every version of the invitation, and who each one is for.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Who has answered, and who still needs asking.')).toBeInTheDocument()
  })

  it('warns that the links leave the site for a login', () => {
    // Without it, the Access login page that greets a first visit to HQ looks
    // like something has gone wrong.
    render(<AdminIndex />)

    expect(screen.getByText(/open in Wedding HQ/)).toBeInTheDocument()
  })
})
