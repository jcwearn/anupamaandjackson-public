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
      screen.getByRole('button', { name: 'Copy link to Taj Krishna Hyderabad' }),
    ).toBeInTheDocument()
  })

  it('leads with the room block and keeps Trivago as a ghost pill', () => {
    // Both links matter: the block is the rate we negotiated, but a guest may
    // still want to check it against the open rate.
    render(
      <HotelCard
        hotel={{
          ...hotel,
          roomBlockUrl: 'https://taj.example/block',
          trivagoUrl: 'https://tri.example',
        }}
      />,
    )

    expect(screen.getByRole('link', { name: /Book our room block/ })).toHaveAttribute(
      'href',
      'https://taj.example/block',
    )
    expect(screen.getByRole('link', { name: /Compare on Trivago/ })).toHaveAttribute(
      'href',
      'https://tri.example',
    )
  })

  it('leaves Trivago as the primary link for a hotel with no block', () => {
    render(<HotelCard hotel={{ ...hotel, trivagoUrl: 'https://tri.example' }} />)

    expect(screen.getByRole('link', { name: /Compare on Trivago/ })).toHaveAttribute(
      'href',
      'https://tri.example',
    )
    expect(screen.queryByRole('link', { name: /Book our room block/ })).not.toBeInTheDocument()
  })

  it('badges a featured hotel, and only a featured hotel', () => {
    const { unmount } = render(<HotelCard hotel={hotel} />)
    expect(screen.queryByText('Special Rate')).not.toBeInTheDocument()
    unmount()

    render(<HotelCard hotel={{ ...hotel, featured: true }} />)
    expect(screen.getByText('Special Rate')).toBeInTheDocument()
  })

  it('prefills the Taj Krishna block link with the two pre-wedding nights', () => {
    // Guards the data, not the component: a later copy-paste that ships the
    // wrong dates or rate code would book guests into the open rate silently.
    const taj = hotels.find((h) => h.slug === 'taj-krishna')!

    expect(taj.roomBlockUrl).toContain('offerRateCode=SANJ201026')
    expect(taj.roomBlockUrl).toContain('from=25/10/2026')
    expect(taj.roomBlockUrl).toContain('to=27/10/2026')
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
