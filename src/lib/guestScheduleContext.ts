import { createContext, useContext } from 'react'
import type { GuestScheduleState } from './useGuestSchedule'
import { universalEvents } from '../data/scheduleEvents'

/**
 * The context, its default, and the hook that reads it.
 *
 * Split out of GuestScheduleProvider.tsx because that file also exports the
 * provider component, and a module that exports both a component and
 * non-components breaks fast refresh — react/only-export-components, which is
 * an error in .oxlintrc.json. The provider imports GuestScheduleContext from
 * here; everything else imports useGuestScheduleContext.
 *
 * A .ts file rather than .tsx: there is no JSX here, only the context object.
 */

/** Per-caller wording for the shared unlock dialog. */
export interface UnlockCopy {
  heading?: string
  blurb?: string
  submitLabel?: string
}

export interface GuestScheduleContextValue extends GuestScheduleState {
  openUnlock: (copy?: UnlockCopy) => void
  /** The Joy fallback offered when the index can't be loaded or the name misses. */
  openJoy: () => void
  /**
   * False outside a provider. FloatingNav is shared with the invite and
   * save-the-date layouts, which have no guest state — the badge checks this so
   * it doesn't offer those pages an unlock that would open nothing.
   */
  available: boolean
}

const anonymous: GuestScheduleContextValue = {
  status: 'anonymous',
  events: universalEvents,
  isAdmin: false,
  candidates: [],
  emailPrompt: false,
  emailFailed: false,
  lookup: () => {},
  submitEmail: () => {},
  skipEmail: () => {},
  chooseCandidate: () => {},
  signOut: () => {},
  openUnlock: () => {},
  openJoy: () => {},
  available: false,
}

// Defaults to the anonymous state rather than throwing. Guest state is an
// enhancement, not a requirement: a component rendered outside the provider —
// the /engagement tree, a focused unit test — should show its locked view, not
// take the page down.
export const GuestScheduleContext = createContext<GuestScheduleContextValue>(anonymous)

export function useGuestScheduleContext(): GuestScheduleContextValue {
  return useContext(GuestScheduleContext)
}
