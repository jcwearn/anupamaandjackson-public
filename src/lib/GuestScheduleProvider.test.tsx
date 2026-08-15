import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GuestScheduleProvider } from './GuestScheduleProvider'
import { useGuestScheduleContext } from './guestScheduleContext'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from './useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('./useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

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
})

// Stands in for any page that offers an unlock.
const Trigger: React.FC = () => {
  const { openUnlock, openJoy } = useGuestScheduleContext()
  return (
    <>
      <button type="button" onClick={() => openUnlock()}>
        Unlock
      </button>
      <button type="button" onClick={openJoy}>
        Joy
      </button>
    </>
  )
}

const renderWithTrigger = () =>
  render(
    <GuestScheduleProvider>
      <Trigger />
    </GuestScheduleProvider>,
  )

const openDialog = (name: string) => {
  const trigger = screen.getByRole('button', { name })
  // jsdom doesn't focus a button on click the way a browser does, and the
  // provider captures document.activeElement when the dialog opens.
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

describe('GuestScheduleProvider', () => {
  it('returns focus to whatever opened the dialog', async () => {
    // The trigger is a different element on every surface, so the provider
    // captures it rather than taking a ref. Losing focus to <body> here strands
    // a keyboard user at the top of the page.
    renderWithTrigger()
    const trigger = openDialog('Unlock')

    // Both dialogs move focus inside themselves on a timeout. Waiting for that
    // is what gives the assertion below any force: close it too early and focus
    // never left the trigger, so it "returns" there whether the provider puts
    // it back or not.
    await waitFor(() => expect(document.activeElement).not.toBe(trigger))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(document.activeElement).toBe(trigger)
  })

  it('returns focus after the Joy dialog too', async () => {
    renderWithTrigger()
    const trigger = openDialog('Joy')

    await waitFor(() => expect(document.activeElement).not.toBe(trigger))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(document.activeElement).toBe(trigger)
  })

  it('survives a trigger that unmounts while the dialog is open', () => {
    // The Schedule page's unlock button disappears the moment the guest is
    // identified, so the captured element is gone by the time focus returns.
    const { rerender } = renderWithTrigger()
    openDialog('Unlock')

    rerender(
      <GuestScheduleProvider>
        <span>identified</span>
      </GuestScheduleProvider>,
    )

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Close' }))).not.toThrow()
  })

  it('reports itself unavailable outside a provider', () => {
    // FloatingNav is shared with layouts that have no guest state; the badge
    // reads this to stay out of them.
    const Probe: React.FC = () => <span>{String(useGuestScheduleContext().available)}</span>

    const { container } = render(<Probe />)
    expect(container.querySelector('span')!.textContent).toBe('false')

    const inside = render(
      <GuestScheduleProvider>
        <Probe />
      </GuestScheduleProvider>,
    )
    // Scoped to the probe: the provider mounts both dialogs alongside it, so
    // the container's own textContent carries their copy too.
    expect(inside.container.querySelector('span')!.textContent).toBe('true')
  })
})
