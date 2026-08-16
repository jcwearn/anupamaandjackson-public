import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminIndex from './AdminIndex'
import { ADMIN_NAV_ITEMS } from '../lib/navItems'

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminIndex />
    </MemoryRouter>,
  )

describe('AdminIndex', () => {
  it('links to every tool', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /Invite Links/ })).toHaveAttribute(
      'href',
      '/admin/invite-links',
    )
    expect(screen.getByRole('link', { name: /Guest Summary/ })).toHaveAttribute(
      'href',
      '/admin/guest-summary',
    )
  })

  it('lists a card for every tool in the section nav', () => {
    // The chip row and this page are two routes to the same tools. A tool added
    // to one and not the other is reachable from only half the section, and the
    // index is the half someone lands on first.
    renderPage()

    const tools = ADMIN_NAV_ITEMS.filter((item) => item.to !== '/admin')
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))

    expect(hrefs.sort()).toEqual(tools.map((tool) => tool.to).sort())
  })

  it('says what each tool is for', () => {
    // The whole reason for an index rather than a bare list of links: these are
    // used rarely enough that "Invite Links" alone does not say which is which.
    renderPage()

    expect(
      screen.getByText('Every version of the invitation, and who each one is for.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Who has answered, and who still needs asking.')).toBeInTheDocument()
  })
})
