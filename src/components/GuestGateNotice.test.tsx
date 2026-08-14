import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GuestGateNotice from './GuestGateNotice'
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

// Through the real provider so the notice's unlock button is checked against
// the dialog it's meant to open, not against a stub.
const renderNotice = () =>
  render(
    <GuestScheduleProvider>
      <GuestGateNotice lockedBlurb="Each event has its own dress code." unlockLabel="Unlock Your Events" />
    </GuestScheduleProvider>
  )

describe('GuestGateNotice', () => {
  it('offers an anonymous guest the way in, and says what it gets them', () => {
    renderNotice()

    expect(screen.getByText('Each event has its own dress code.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock Your Events' })).toBeEnabled()
  })

  it('holds the trigger closed until the index has loaded', () => {
    setState({ status: 'loading' })
    renderNotice()

    expect(screen.getByRole('button', { name: 'Unlock Your Events' })).toBeDisabled()
  })

  it('opens the shared unlock dialog', () => {
    renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Events' }))

    expect(screen.getByRole('dialog', { name: 'Unlock your schedule' })).toBeInTheDocument()
  })

  it('tells an identified guest whose invitation they are reading', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderNotice()

    expect(screen.getByText(/Showing your invitation, Grace/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock Your Events' })).not.toBeInTheDocument()
  })

  it('lets an identified guest say it is not them', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))

    expect(signOut).toHaveBeenCalled()
  })

  it('points at Joy rather than a lookup that cannot succeed', () => {
    // A failed index load leaves nothing to unlock, so the notice must not keep
    // offering a button that opens an empty dialog.
    setState({ status: 'error' })
    renderNotice()

    expect(screen.queryByRole('button', { name: 'Unlock Your Events' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'view your full details on Joy' })
    ).toBeInTheDocument()
  })
})
