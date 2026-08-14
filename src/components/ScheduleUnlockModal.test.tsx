import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScheduleUnlockModal from './ScheduleUnlockModal'
import type { GuestScheduleStatus } from '../lib/useGuestSchedule'

const noop = () => {}

type Overrides = Partial<React.ComponentProps<typeof ScheduleUnlockModal>>

const renderModal = (overrides: Overrides = {}) => {
  const props = {
    open: true,
    onClose: noop,
    status: 'anonymous' as GuestScheduleStatus,
    candidates: [] as string[],
    emailPrompt: false,
    emailFailed: false,
    onSubmit: noop as (first: string, last: string) => void,
    onSubmitEmail: noop as (email: string) => void,
    onSkipEmail: noop,
    onChooseCandidate: noop as (index: number) => void,
    onViewOnJoy: noop,
    ...overrides,
  }
  return render(<ScheduleUnlockModal {...props} />)
}

const typeName = (first: string, last: string) => {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: first } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: last } })
}

const submit = () => fireEvent.submit(screen.getByRole('button', { name: /Unlock/ }).closest('form')!)

describe('ScheduleUnlockModal', () => {
  it('is a labelled modal dialog', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Unlock your schedule')
  })

  // The dialog is shared by every surface that offers an unlock — the Schedule
  // header, the Outfits tip, the nav badge — and each one names the thing it is
  // about. Defaults belong to the Schedule page, which asked first.
  describe('wording supplied by the caller', () => {
    it('defaults to the Schedule page’s', () => {
      renderModal()

      expect(screen.getByRole('dialog')).toHaveAccessibleName('Unlock your schedule')
      expect(screen.getByRole('button', { name: 'Unlock Your Schedule' })).toBeInTheDocument()
      expect(screen.getByText(/we’ll show you the events you’re invited to/)).toBeInTheDocument()
    })

    it('takes a heading, a blurb and a submit label', () => {
      renderModal({
        heading: 'Outfits for your events',
        blurb: 'Add your name and we’ll show you the dress code for each event.',
        submitLabel: 'Show My Events',
      })

      expect(screen.getByRole('dialog')).toHaveAccessibleName('Outfits for your events')
      expect(screen.getByRole('button', { name: 'Show My Events' })).toBeInTheDocument()
      expect(
        screen.getByText('Add your name and we’ll show you the dress code for each event.')
      ).toBeInTheDocument()
    })

    it('keeps the busy label while a lookup is in flight', () => {
      // The caller's label must not reappear mid-lookup and suggest the button
      // is ready to press again.
      renderModal({ submitLabel: 'Show My Events', status: 'resolving' })

      expect(screen.getByRole('button', { name: 'Looking…' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Show My Events' })).not.toBeInTheDocument()
    })
  })

  it('hands both names to the lookup', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })

    typeName('Grace', 'Hopper')
    submit()

    expect(onSubmit).toHaveBeenCalledWith('Grace', 'Hopper')
  })

  it('accepts a first name alone, since one-name guests are on the list', () => {
    // 'Prince' in the roster fixture has no last name.
    const onSubmit = vi.fn()
    renderModal({ onSubmit })

    typeName('Prince', '')
    submit()

    expect(onSubmit).toHaveBeenCalledWith('Prince', '')
  })

  it('does not look up a blank name', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })

    typeName('   ', 'Hopper')
    submit()

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the lookup is running and blocks a second submit', () => {
    renderModal({ status: 'resolving' })

    const button = screen.getByRole('button', { name: 'Looking…' })
    expect(button).toBeDisabled()
  })

  it('offers a way out when the name is not found', () => {
    const onViewOnJoy = vi.fn()
    renderModal({ status: 'notFound', onViewOnJoy })

    expect(screen.getByRole('status')).toHaveTextContent(/couldn’t find that name/)
    fireEvent.click(screen.getByRole('button', { name: 'view your details on Joy' }))

    expect(onViewOnJoy).toHaveBeenCalled()
  })

  it('shows no not-found message before anyone has looked anything up', () => {
    renderModal()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('asks which one is you, offering one button per candidate', () => {
    renderModal({ status: 'ambiguous', candidates: ['With Mary Smith', 'With Peter Smith'] })

    expect(screen.getByText(/more than one guest by that name/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'With Mary Smith' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'With Peter Smith' })).toBeInTheDocument()
    // The form is replaced by the choice, not shown alongside it.
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('reports the chosen household by its position in the bucket', () => {
    // An off-by-one here would serve a guest the other household's schedule.
    const onChooseCandidate = vi.fn()
    renderModal({
      status: 'ambiguous',
      candidates: ['With Mary Smith', 'With Peter Smith'],
      onChooseCandidate,
    })

    fireEvent.click(screen.getByRole('button', { name: 'With Peter Smith' }))

    expect(onChooseCandidate).toHaveBeenCalledWith(1)
  })

  describe('email check before the households are shown', () => {
    it('asks for an email instead of listing the candidates', () => {
      renderModal({
        status: 'ambiguous',
        emailPrompt: true,
        candidates: ['With Mary Smith', 'With Peter Smith'],
      })

      expect(screen.getByText(/enter the email you rsvp’d with/i)).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'With Mary Smith' })).not.toBeInTheDocument()
    })

    it('hands the typed email to the lookup', () => {
      const onSubmitEmail = vi.fn()
      renderModal({ status: 'ambiguous', emailPrompt: true, onSubmitEmail })

      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'mary@example.com' },
      })
      fireEvent.submit(
        screen.getByRole('button', { name: 'Find My Invitation' }).closest('form')!
      )

      expect(onSubmitEmail).toHaveBeenCalledWith('mary@example.com')
    })

    it('does not submit a blank email', () => {
      const onSubmitEmail = vi.fn()
      renderModal({ status: 'ambiguous', emailPrompt: true, onSubmitEmail })

      fireEvent.submit(
        screen.getByRole('button', { name: 'Find My Invitation' }).closest('form')!
      )

      expect(onSubmitEmail).not.toHaveBeenCalled()
    })

    it('lets a guest with no email on file skip ahead', () => {
      const onSkipEmail = vi.fn()
      renderModal({ status: 'ambiguous', emailPrompt: true, onSkipEmail })

      fireEvent.click(screen.getByRole('button', { name: 'I didn’t share an email' }))

      expect(onSkipEmail).toHaveBeenCalled()
    })

    it('explains the fallthrough when the email did not match', () => {
      renderModal({
        status: 'ambiguous',
        emailFailed: true,
        candidates: ['With Mary Smith', 'With Peter Smith'],
      })

      expect(screen.getByRole('status')).toHaveTextContent(/couldn’t match that email/)
      expect(screen.getByRole('button', { name: 'With Mary Smith' })).toBeInTheDocument()
    })
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('does not listen for Escape while closed', () => {
    // Otherwise it would swallow Escape from whatever is actually on screen.
    const onClose = vi.fn()
    renderModal({ open: false, onClose })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on the close button', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('locks body scroll while open and gives it back on close', () => {
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('is hidden from assistive tech while closed', () => {
    renderModal({ open: false })

    expect(screen.getByRole('dialog', { hidden: true }).closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })
})
