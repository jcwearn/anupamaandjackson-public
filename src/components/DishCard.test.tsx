import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DishCard from './DishCard'
import type { Dish } from '../data/eats'

// A fixture rather than a real dish: the page-level tests already walk the live
// data, which means the optional fields are only exercised as long as today's
// content happens to use them both ways. These pin the branches themselves.
const dish: Dish = {
  slug: 'test-dish',
  diet: 'vegan',
  name: 'Test dish',
  kind: 'The sides',
  note: 'A short note about the dish.',
  searchUrl: 'https://www.google.com/search?q=test+dish',
}

describe('DishCard', () => {
  it('carries the slug as its anchor id, so /travel/food#slug resolves', () => {
    const { container } = render(<DishCard dish={dish} />)

    expect(container.querySelector('li')).toHaveAttribute('id', 'test-dish')
  })

  it('shows the kind, the note and a copy-link button named after the dish', () => {
    render(<DishCard dish={dish} />)

    expect(screen.getByRole('heading', { name: 'Test dish' })).toBeInTheDocument()
    expect(screen.getByText('The sides')).toBeInTheDocument()
    expect(screen.getByText('A short note about the dish.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link to Test dish' })).toBeInTheDocument()
  })

  it('badges the dish with its diet', () => {
    render(<DishCard dish={dish} />)

    expect(screen.getByText('Vegan')).toBeInTheDocument()
  })

  it('sends the search link out in a new tab, safely', () => {
    render(<DishCard dish={dish} />)

    const link = screen.getByRole('link', { name: /Look it up/ })
    expect(link).toHaveAttribute('href', dish.searchUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('offers "where to try it" only when the dish names somewhere', () => {
    // By text, not by role: an <a> with no href has no link role, so a pill
    // rendered unconditionally would slip past a role query as a dead chip.
    const { unmount } = render(<DishCard dish={dish} />)
    expect(screen.queryByText('Where to try it')).toBeNull()
    unmount()

    render(<DishCard dish={{ ...dish, whereSlug: 'paradise' }} />)
    expect(screen.getByRole('link', { name: 'Where to try it' })).toHaveAttribute(
      'href',
      '#paradise',
    )
  })

  it('hangs the photo only when the dish has one, in a reserved box', () => {
    // Whatever the layout, the picture is optional: a dish without one must
    // render the same card it always did, not an empty frame.
    const { container, unmount } = render(<DishCard dish={dish} layout="feature" />)
    expect(container.querySelector('img')).toBeNull()
    unmount()

    const photo = { src: '/x.jpg', alt: 'A test photo of the dish', width: 1000, height: 750 }
    render(<DishCard dish={{ ...dish, photo }} layout="feature" reverse />)
    const img = screen.getByAltText('A test photo of the dish')
    expect(img).toHaveAttribute('width', '1000')
    expect(img).toHaveAttribute('height', '750')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})
