import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InviteLinks from './InviteLinks'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import { SITE_ORIGIN } from '../lib/constants'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

const writeText = vi.fn(() => Promise.resolve())

const setState = (overrides: Partial<GuestScheduleState> = {}) => {
  state.current = {
    status: 'anonymous',
    events: universalEvents,
    isAdmin: false,
    candidates: [],
    emailPrompt: false,
    emailFailed: false,
    submitEmail: vi.fn(),
    skipEmail: vi.fn(),
    lookup: vi.fn(),
    chooseCandidate: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
})

// Through the real provider, with only the underlying hook stubbed — the page
// reads the admin flag from the context.
const renderPage = () =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>
        <InviteLinks />
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const paths = [
  '/invites/wearn/',
  '/invites/tadanki/',
  '/invites/tadanki/reception/',
  '/invites/tadanki/muhurtham/',
]

describe('InviteLinks gate', () => {
  it('shows an anonymous visitor the way in, not the links', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
    expect(screen.queryByText(`${SITE_ORIGIN}/invites/wearn/`)).not.toBeInTheDocument()
  })

  it('withholds the links from an identified guest who is not an admin', () => {
    // The gate is the admin tag, not merely being known to the site — every
    // other guest-aware page on the site unlocks on `identified` alone.
    setState({ status: 'identified', displayName: 'Ada', isAdmin: false })
    renderPage()

    expect(screen.queryByText(`${SITE_ORIGIN}/invites/wearn/`)).not.toBeInTheDocument()
  })

  it('tells an identified non-admin why the page is empty, and offers a way out', () => {
    // GuestGateNotice would print "Showing your invitation, Ada" here — a
    // success message above nothing at all, with no way to correct it.
    const signOut = vi.fn()
    setState({ status: 'identified', displayName: 'Ada', isAdmin: false, signOut })
    renderPage()

    expect(screen.getByText(/We know you as Ada/)).toBeInTheDocument()
    expect(screen.queryByText(/Showing your invitation/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('still offers the unlock while the lookup is resolving', () => {
    // Mid-lookup isAdmin is false but the guest is not yet identified, so the
    // "not for you" copy would be a lie.
    setState({ status: 'resolving', isAdmin: false })
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
  })
})

describe('InviteLinks contents', () => {
  beforeEach(() => {
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
  })

  it('lists every invite variant with its scope', () => {
    renderPage()

    for (const path of paths) {
      expect(screen.getByText(`${SITE_ORIGIN}${path}`)).toBeInTheDocument()
    }

    // Only /invites/tadanki/muhurtham/ drops the reception card, and only the
    // two narrowed variants drop the sangeet one.
    expect(screen.getAllByText('Sangeet, Muhurtham & Reception')).toHaveLength(2)
    expect(screen.getByText('Muhurtham & Reception')).toBeInTheDocument()
    expect(screen.getByText('Muhurtham only')).toBeInTheDocument()
  })

  it('points each link at the page it names', () => {
    renderPage()

    for (const path of paths) {
      const link = screen.getByRole('link', { name: `${SITE_ORIGIN}${path}` })
      // The visible text is absolute so it can be read off the screen and typed
      // out; the href stays relative so following it routes client-side.
      expect(link).toHaveAttribute('href', path)
    }
  })

  it('copies the production URL, not the one being previewed', () => {
    // window.location.origin is localhost under `vite preview`, and a link
    // copied from there is dead for whoever receives it.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: `Copy ${SITE_ORIGIN}/invites/wearn/` }))

    expect(writeText).toHaveBeenCalledWith(`${SITE_ORIGIN}/invites/wearn/`)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
  })

  it('offers both invite PDFs for viewing and download', () => {
    renderPage()

    const hrefs = (name: string) =>
      screen.getAllByRole('link', { name }).map((link) => link.getAttribute('href'))

    const files = ['/invites/invite-tadanki.pdf', '/invites/invite-wearn.pdf']
    expect(hrefs('View').sort()).toEqual(files)
    expect(hrefs('Download').sort()).toEqual(files)

    // Without the attribute the browser navigates to the PDF instead of saving
    // it, which makes the two links do the same thing.
    for (const link of screen.getAllByRole('link', { name: 'Download' })) {
      expect(link).toHaveAttribute('download')
    }
  })
})
