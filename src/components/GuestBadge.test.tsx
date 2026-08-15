import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GuestBadge from './GuestBadge'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

const signOut = vi.fn()

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
    signOut,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
})

const renderBadge = (variant: 'bar' | 'menu' = 'bar') =>
  render(
    <GuestScheduleProvider>
      <GuestBadge variant={variant} />
    </GuestScheduleProvider>,
  )

describe('GuestBadge', () => {
  it('offers an anonymous guest a way to identify themselves', () => {
    renderBadge()

    expect(screen.getByRole('button', { name: 'Unlock your details' })).toBeInTheDocument()
  })

  it('abbreviates on the bar but keeps the full accessible name', () => {
    // The nav row has no width to spare at its breakpoint — spelling this out
    // there overflows the bar. Screen readers still get the whole phrase.
    renderBadge()
    const trigger = screen.getByRole('button', { name: 'Unlock your details' })

    expect(trigger).toHaveTextContent('Unlock')
    expect(trigger).not.toHaveTextContent('Unlock your details')
  })

  it('spells it out in the dropdown, where there is room', () => {
    renderBadge('menu')

    expect(screen.getByRole('button', { name: 'Unlock your details' })).toHaveTextContent(
      'Unlock your details',
    )
  })

  it('opens the shared unlock dialog', () => {
    renderBadge()

    fireEvent.click(screen.getByRole('button', { name: 'Unlock your details' }))

    expect(screen.getByRole('dialog', { name: 'Unlock your details' })).toBeInTheDocument()
  })

  it('names an identified guest', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderBadge()

    expect(screen.getByRole('button', { name: 'Signed in as Grace' })).toBeInTheDocument()
  })

  it('keeps sign-out behind a tap on the bar, so the badge is not a tripwire', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderBadge()

    expect(screen.queryByRole('menuitem', { name: 'Not you? Sign out' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Signed in as Grace' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Not you? Sign out' }))

    expect(signOut).toHaveBeenCalled()
  })

  it('lays both parts out flat in the dropdown, where there is room', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderBadge('menu')

    expect(screen.getByText('Grace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not you? Sign out' }))

    expect(signOut).toHaveBeenCalled()
  })

  it('says nothing while the index is still loading', () => {
    setState({ status: 'loading' })
    renderBadge()

    // ByRole, not the container: the provider always has its closed dialogs in
    // the DOM, and only the accessibility tree knows they're hidden.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says nothing when the index failed, rather than offering a dead unlock', () => {
    setState({ status: 'error' })
    renderBadge()

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('stays out of layouts that have no guest state', () => {
    // FloatingNav is shared with the invite and save-the-date pages, which sit
    // outside the provider entirely.
    const { container } = render(<GuestBadge variant="menu" />)

    expect(container).toBeEmptyDOMElement()
  })
})
