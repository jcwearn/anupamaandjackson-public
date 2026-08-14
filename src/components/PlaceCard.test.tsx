import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlaceCard from './PlaceCard'
import { places } from '../data/places'
import {
  AnchorScrollMt,
  ANCHOR_SCROLL_MT,
  ANCHOR_SCROLL_MT_UNDER_SECTION_NAV,
} from '../lib/anchorOffset'

const charminar = places[0]

describe('PlaceCard', () => {
  it('shows the place, its era and its facts', () => {
    render(<PlaceCard place={charminar} />)

    expect(screen.getByRole('heading', { name: charminar.name })).toBeInTheDocument()
    expect(screen.getByText(charminar.built)).toBeInTheDocument()
    expect(screen.getByText(charminar.about)).toBeInTheDocument()
    expect(screen.getByText(charminar.bestTime)).toBeInTheDocument()
    expect(screen.getByText(charminar.notToMiss)).toBeInTheDocument()
  })

  it('owns the deep-link id only when anchored', () => {
    // The carousel renders two faces which can hold the same place. If both
    // claimed the id the document would have it twice, and a link could scroll
    // to the face that's turned away.
    const { container, rerender } = render(<PlaceCard place={charminar} anchored />)
    expect(container.querySelector(`#${charminar.slug}`)).not.toBeNull()

    rerender(<PlaceCard place={charminar} anchored={false} />)
    expect(container.querySelector(`#${charminar.slug}`)).toBeNull()
  })

  it('takes its scroll offset from the layout it is in', () => {
    // Under a SectionNav the anchor has to clear that bar too, or a deep link
    // lands behind it.
    const { container } = render(
      <AnchorScrollMt.Provider value={ANCHOR_SCROLL_MT_UNDER_SECTION_NAV}>
        <PlaceCard place={charminar} anchored />
      </AnchorScrollMt.Provider>
    )
    const anchor = container.querySelector(`#${charminar.slug}`)!

    expect(anchor.className).toContain(ANCHOR_SCROLL_MT_UNDER_SECTION_NAV)
    expect(anchor.className).not.toContain(ANCHOR_SCROLL_MT)
  })

  it('drops the photo when measuring, keeping the space it would take', () => {
    // The carousel stacks all nine invisibly to size the deck. Loading nine
    // photos nobody sees would be pure waste, and the photo is a fixed aspect
    // ratio, so a box of the same shape measures the same.
    const { container } = render(<PlaceCard place={charminar} measuring />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.aspect-\\[2\\/1\\]')).not.toBeNull()
  })

  it('does not stretch when measuring, or the deck has nothing to size against', () => {
    // A live card fills the deck. A measuring copy asking for 100% of a cell
    // that is sized by its contents leaves the cell nothing to measure.
    const live = render(<PlaceCard place={charminar} />)
    expect(live.container.firstElementChild!.className).toContain('h-full')

    const measuring = render(<PlaceCard place={charminar} measuring />)
    expect(measuring.container.firstElementChild!.className).not.toContain('h-full')
  })

  it('links every pairing at a place this page actually carries', () => {
    // `nearby` is a hand-written list of slugs, so a renamed place leaves a
    // dead jump behind.
    const slugs = new Set(places.map((place) => place.slug))

    for (const place of places) {
      const { container, unmount } = render(<PlaceCard place={place} />)
      const fragments = [...container.querySelectorAll('a[href^="#"]')].map(
        (a) => a.getAttribute('href')!.slice(1)
      )

      expect(fragments).toEqual(place.nearby)
      for (const fragment of fragments) {
        expect(slugs.has(fragment), `${place.slug} pairs with unknown #${fragment}`).toBe(true)
      }
      unmount()
    }
  })

  it('names the pairings rather than showing their slugs', () => {
    render(<PlaceCard place={charminar} />)

    for (const slug of charminar.nearby) {
      const name = places.find((place) => place.slug === slug)!.name
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `#${slug}`)
    }
  })

  it('offers a copy-link button labelled from the place', () => {
    render(<PlaceCard place={charminar} />)

    expect(
      screen.getByRole('button', { name: `Copy link to ${charminar.name}` })
    ).toBeInTheDocument()
  })
})
