import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ScheduleUnlockModal from '../components/ScheduleUnlockModal'
import RsvpModal from '../components/RsvpModal'
import { useGuestSchedule } from './useGuestSchedule'
// The context, its value type and the hook live in guestScheduleContext.ts so
// this file exports only the provider component (react/only-export-components).
import { GuestScheduleContext } from './guestScheduleContext'
import type { UnlockCopy } from './guestScheduleContext'

/**
 * Owns the single guest lookup for the whole site, plus the dialogs that drive
 * it.
 *
 * One instance is the point: `useGuestSchedule` fetches a ~285 KB index and
 * stretches the guest's name through 150k PBKDF2 iterations, so a second
 * consumer calling the hook directly would pay both again and could drift out
 * of sync with the first. Pages read `useGuestScheduleContext()` instead.
 *
 * The modals live here for the same reason — every surface that wants to offer
 * an unlock would otherwise re-implement open state, focus return, and the
 * close-once-identified effect.
 */
export const GuestScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const guest = useGuestSchedule()
  const [unlockCopy, setUnlockCopy] = useState<UnlockCopy | null>(null)
  const [joyOpen, setJoyOpen] = useState(false)
  // Whatever was focused when the dialog opened. Captured rather than passed in
  // by the caller: the trigger can be any button on any page, and several of
  // them (the Outfits prompt) unmount as soon as the lookup succeeds.
  const triggerRef = useRef<HTMLElement | null>(null)

  const identified = guest.status === 'identified'

  const rememberTrigger = () => {
    const active = document.activeElement
    triggerRef.current = active instanceof HTMLElement ? active : null
  }

  const openUnlock = useCallback((copy?: UnlockCopy) => {
    rememberTrigger()
    setUnlockCopy(copy ?? {})
  }, [])

  const openJoy = useCallback(() => {
    rememberTrigger()
    setUnlockCopy(null)
    setJoyOpen(true)
  }, [])

  const closeUnlock = useCallback(() => {
    setUnlockCopy(null)
    triggerRef.current?.focus()
  }, [])

  // Close on success so the personalized content behind the dialog is visible
  // without the guest having to dismiss anything. Focus goes back to whatever
  // opened it, which on the Schedule page is the button that just disappeared —
  // hence the optional chaining in closeUnlock rather than a required ref.
  useEffect(() => {
    if (identified) setUnlockCopy(null)
  }, [identified])

  const value = useMemo(
    () => ({ ...guest, openUnlock, openJoy, available: true }),
    [guest, openUnlock, openJoy],
  )

  return (
    <GuestScheduleContext.Provider value={value}>
      {children}

      <ScheduleUnlockModal
        open={unlockCopy !== null}
        onClose={closeUnlock}
        status={guest.status}
        candidates={guest.candidates}
        emailPrompt={guest.emailPrompt}
        emailFailed={guest.emailFailed}
        onSubmit={guest.lookup}
        onSubmitEmail={guest.submitEmail}
        onSkipEmail={guest.skipEmail}
        onChooseCandidate={guest.chooseCandidate}
        onViewOnJoy={openJoy}
        heading={unlockCopy?.heading}
        blurb={unlockCopy?.blurb}
        submitLabel={unlockCopy?.submitLabel}
      />

      <RsvpModal
        open={joyOpen}
        onClose={() => {
          setJoyOpen(false)
          triggerRef.current?.focus()
        }}
        heading="Before you go"
        description="Use this password to view our Wedding Homepage on Joy."
        ctaLabel="View Wedding Homepage"
      />
    </GuestScheduleContext.Provider>
  )
}
