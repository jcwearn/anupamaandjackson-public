import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GolkondaStayModal from './GolkondaStayModal'
import type { GolkondaRoom } from '../lib/useGuestSchedule'

const room: GolkondaRoom = {
  bed: 'twin',
  roommates: ['Grace Hopper'],
  checkIn: '2026-10-27',
  checkOut: '2026-10-29',
}

const dialog = () => screen.getByRole('dialog', { name: 'Your Golkonda Stay' })

describe('GolkondaStayModal', () => {
  it('shows who they share with, the bed and the nights', () => {
    render(<GolkondaStayModal open onClose={() => {}} room={room} displayName="Ada" />)

    expect(dialog()).toHaveTextContent('For Ada')
    expect(dialog()).toHaveTextContent('Twin beds')
    expect(dialog()).toHaveTextContent('with Grace Hopper')
    expect(dialog()).toHaveTextContent('Oct 27 – 29')
    expect(dialog()).toHaveTextContent('2 nights')
  })

  it('says nothing about money, the room number or the room type', () => {
    // How the room is paid for is the card's business, for this guest alone;
    // the number and type stay with the planners.
    render(<GolkondaStayModal open onClose={() => {}} room={room} displayName="Ada" />)

    const text = dialog().textContent!
    for (const word of ['$', 'pay', 'covered', 'Villa (', 'Premium', 'Room No']) {
      expect(text, word).not.toContain(word)
    }
  })

  it('tells a guest alone that the room is theirs', () => {
    render(<GolkondaStayModal open onClose={() => {}} room={{ ...room, roommates: [] }} />)

    expect(dialog()).toHaveTextContent('a room of your own')
  })

  it('closes on Escape, the backdrop and the close button', () => {
    const onClose = vi.fn()
    const { container } = render(<GolkondaStayModal open onClose={onClose} room={room} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(container.querySelector('.backdrop-blur-sm')!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays hidden from assistive tech while closed', () => {
    const { container } = render(<GolkondaStayModal open={false} onClose={() => {}} room={room} />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
