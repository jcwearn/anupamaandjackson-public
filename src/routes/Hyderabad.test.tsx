import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Hyderabad from './Hyderabad'
import TravelTips from './TravelTips'
import { places } from '../data/places'

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Element.prototype.scrollIntoView = vi.fn()
})

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Hyderabad places', () => {
  it('gives every place a unique, URL-safe slug', () => {
    const slugs = places.map((place) => place.slug)

    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug, `"${slug}" needs no escaping in a URL fragment`).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('offers every place from the carousel', () => {
    // The nine are behind a carousel now, so only the showing card is in the
    // document — but every one of them has to be reachable without flipping
    // through the lot.
    renderPage(<Hyderabad />)

    for (const place of places) {
      expect(screen.getByRole('button', { name: place.name })).toBeInTheDocument()
    }
  })

  it('gives the card on show a copy-link button, under its own id', () => {
    const { container } = renderPage(<Hyderabad />)
    const card = container.querySelector(`#${places[0].slug}`)

    expect(card, `no card for #${places[0].slug}`).not.toBeNull()
    expect(card!.querySelector('button[aria-label^="Copy link to "]')).not.toBeNull()
    // Both faces render, and they can hold the same place — the turned-away one
    // must not claim the id too.
    expect(container.querySelectorAll(`#${places[0].slug}`)).toHaveLength(1)
  })

  it('describes every photo it renders', () => {
    const { container } = renderPage(<Hyderabad />)
    const images = [...container.querySelectorAll('img')]

    expect(images.length).toBeGreaterThan(0)
    for (const img of images) {
      expect(img.getAttribute('alt')).toBeTruthy()
    }
    // The rest are only ever a flip away, so check the source they come from.
    for (const place of places) {
      expect(place.photo.alt, `${place.slug} has no alt text`).toBeTruthy()
    }
  })

  it('every in-page link lands on a card that exists', () => {
    // The day plans and the "pairs well with" rows both point at slugs by hand,
    // so a renamed place would otherwise leave a dead jump behind.
    const { container } = renderPage(<Hyderabad />)
    const slugs = new Set(places.map((place) => place.slug))
    const fragments = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')!.slice(1),
    )

    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(slugs.has(fragment), `no place for #${fragment}`).toBe(true)
    }
  })

  it('every /travel/tips deep link resolves to a section on that page', () => {
    const travelTips = renderPage(<TravelTips />)
    const travelTipsIds = new Set(
      [...travelTips.container.querySelectorAll('[id]')].map((el) => el.id),
    )
    travelTips.unmount()

    const { container } = renderPage(<Hyderabad />)
    const fragments = [...container.querySelectorAll('a[href^="/travel/tips#"]')].map(
      (a) => a.getAttribute('href')!.split('#')[1],
    )

    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(travelTipsIds.has(fragment), `/travel/tips has no #${fragment}`).toBe(true)
    }
  })

  it('still answers #eat-like-a-local, and forwards it to the food page', () => {
    // The guide moved to /travel/food and the pointer section that used to
    // catch this anchor is gone, but /travel/hyderabad#eat-like-a-local is
    // already shared — the old link has to keep landing on the food guide
    // rather than on nothing at all.
    render(
      <MemoryRouter initialEntries={['/travel/hyderabad#eat-like-a-local']}>
        <Routes>
          <Route path="/travel/hyderabad" element={<Hyderabad />} />
          <Route path="/travel/food" element={<p>the food guide</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('the food guide')).toBeInTheDocument()
  })
})
