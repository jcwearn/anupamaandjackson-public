import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EatPlaceCard from './EatPlaceCard'
import type { EatPlace } from '../data/eats'
import { places } from '../data/places'

// See DishCard.test.tsx: a fixture, so the optional website and "pairs with"
// branches are covered whatever the live data happens to hold. Two of the six
// real places ship without a website today — that must not be what proves the
// no-website path works.
const place: EatPlace = {
  slug: 'test-place',
  name: 'Test Place',
  kind: 'Biryani',
  area: 'Banjara Hills',
  note: 'A short note about the place.',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Test+Place',
}

const renderCard = (p: EatPlace) =>
  render(
    <MemoryRouter>
      <EatPlaceCard place={p} />
    </MemoryRouter>,
  )

describe('EatPlaceCard', () => {
  it('carries the slug as its anchor id, so a dish can link to it', () => {
    const { container } = renderCard(place)

    expect(container.querySelector('li')).toHaveAttribute('id', 'test-place')
  })

  it('shows the kind, area, note and a copy-link button named after the place', () => {
    renderCard(place)

    expect(screen.getByRole('heading', { name: 'Test Place' })).toBeInTheDocument()
    expect(screen.getByText('Biryani')).toBeInTheDocument()
    expect(screen.getByText('Banjara Hills')).toBeInTheDocument()
    expect(screen.getByText('A short note about the place.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link to Test Place' })).toBeInTheDocument()
  })

  it('always offers a map, in a new tab, safely', () => {
    renderCard(place)

    const map = screen.getByRole('link', { name: /Map/ })
    expect(map).toHaveAttribute('href', place.mapUrl)
    expect(map).toHaveAttribute('target', '_blank')
    expect(map).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('offers a website only when there is one', () => {
    // Two of the real places have no usable official site — one domain is gone,
    // one was taken over — so the card has to read fine without the pill rather
    // than render an empty one.
    // By text, not by role: an <a> with no href has no link role at all, so
    // queryByRole would happily miss a pill rendered unconditionally into a
    // dead, hrefless chip that still looks clickable.
    const { unmount } = renderCard(place)
    expect(screen.queryByText(/Website/)).toBeNull()
    unmount()

    renderCard({ ...place, websiteUrl: 'https://example.com/' })
    const site = screen.getByRole('link', { name: /Website/ })
    expect(site).toHaveAttribute('href', 'https://example.com/')
    expect(site).toHaveAttribute('target', '_blank')
    expect(site).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('links "pairs with" across to the sight on Things to Do, by name', () => {
    // The sights live on another page, so this must not be a bare #fragment —
    // that would jump to nothing at all from here.
    const { unmount } = renderCard(place)
    expect(screen.queryByText(/Pairs with/)).toBeNull()
    unmount()

    renderCard({ ...place, nearbySlug: 'charminar' })
    const name = places.find((p) => p.slug === 'charminar')!.name
    expect(screen.getByRole('link', { name })).toHaveAttribute(
      'href',
      '/travel/hyderabad#charminar',
    )
  })

  it('falls back to the slug if it names a sight that no longer exists', () => {
    // Better a link reading "gone-place" than a card that throws mid-render.
    renderCard({ ...place, nearbySlug: 'gone-place' })

    expect(screen.getByRole('link', { name: 'gone-place' })).toHaveAttribute(
      'href',
      '/travel/hyderabad#gone-place',
    )
  })

  it('hangs the photo only when the place has one, in a reserved box', () => {
    const { container, unmount } = renderCard(place)
    expect(container.querySelector('img')).toBeNull()
    unmount()

    const photo = { src: '/x.jpg', alt: 'A test photo of the place', width: 1000, height: 750 }
    render(
      <MemoryRouter>
        <EatPlaceCard place={{ ...place, photo }} reverse />
      </MemoryRouter>,
    )
    const img = screen.getByAltText('A test photo of the place')
    expect(img).toHaveAttribute('width', '1000')
    expect(img).toHaveAttribute('height', '750')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})
