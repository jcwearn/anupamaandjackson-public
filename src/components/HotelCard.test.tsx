import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HotelCard from './HotelCard'
import { hotels } from '../data/hotels'
import type { Hotel } from '../data/hotels'

const hotel: Hotel = {
  slug: 'taj-krishna',
  name: 'Taj Krishna Hyderabad',
  section: 'pre-wedding',
  description: 'A grande dame near Banjara Hills.',
  distance: '10 min from the Pellikuthuru',
}

describe('HotelCard', () => {
  it('exposes the hotel slug as the anchor id, so /hotels#slug resolves', () => {
    const { container } = render(<HotelCard hotel={hotel} />)

    const item = container.querySelector('li')
    expect(item).toHaveAttribute('id', 'taj-krishna')
  })

  it('offers a copy-link button named after the hotel', () => {
    render(<HotelCard hotel={hotel} />)

    expect(
      screen.getByRole('button', { name: 'Copy link to Taj Krishna Hyderabad' })
    ).toBeInTheDocument()
  })

  it('gives every hotel in the data a usable, unique anchor', () => {
    // Guards the data as much as the component: a duplicated or non-URL-safe
    // slug would silently break deep links.
    const slugs = hotels.map((h) => h.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
