import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrnamentalFrame, { MandalaDivider } from './OrnamentalFrame'

const HERO_PADDING = 'p-8 sm:p-12 md:p-16'
const HERO_CORNERS = 'h-14 w-14 sm:h-20 sm:w-20'

describe('OrnamentalFrame', () => {
  it('keeps the landing hero’s padding and corner size by default', () => {
    // Landing.tsx passes neither prop. The props exist for the place cards,
    // which want the same frame much smaller — this is what stops that from
    // quietly resizing the hero.
    const { container } = render(
      <OrnamentalFrame>
        <p>Anupama & Jackson</p>
      </OrnamentalFrame>
    )

    expect(screen.getByText('Anupama & Jackson').parentElement!.className).toBe(HERO_PADDING)
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('class')).toContain(HERO_CORNERS)
    }
  })

  it('takes a tighter padding and smaller corners when asked', () => {
    const { container } = render(
      <OrnamentalFrame contentClassName="p-5" cornerClassName="h-10 w-10">
        <p>Charminar</p>
      </OrnamentalFrame>
    )

    expect(screen.getByText('Charminar').parentElement!.className).toBe('p-5')
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.getAttribute('class')).toContain('h-10 w-10')
      expect(svg.getAttribute('class')).not.toContain('h-14')
    }
  })

  it('puts a mandala in all four corners, each turned a quarter further', () => {
    const { container } = render(
      <OrnamentalFrame>
        <p>…</p>
      </OrnamentalFrame>
    )
    // Split rather than substring-match: "rotate-90" is inside "-rotate-90".
    const corners = [...container.querySelectorAll('svg')].map(
      (s) => new Set(s.getAttribute('class')!.split(/\s+/))
    )
    const turned = (name: string) => corners.filter((classes) => classes.has(name)).length

    expect(corners).toHaveLength(4)
    expect(turned('rotate-90')).toBe(1)
    expect(turned('rotate-180')).toBe(1)
    expect(turned('-rotate-90')).toBe(1)
    // The fourth is the unrotated original.
    expect(corners.filter((c) => !c.has('rotate-90') && !c.has('rotate-180') && !c.has('-rotate-90'))
    ).toHaveLength(1)
  })

  it('carries no ids, so four copies can prerender and hydrate', () => {
    // The whole reason the ornaments are plain transform attributes rather than
    // <defs>/<use>: ids have to match between the server render and the client,
    // and four instances of the same corner would collide.
    const { container } = render(
      <OrnamentalFrame>
        <MandalaDivider />
      </OrnamentalFrame>
    )

    expect(container.querySelectorAll('[id]')).toHaveLength(0)
    expect(container.querySelectorAll('defs, use')).toHaveLength(0)
  })

  it('hides the ornaments from screen readers and from the pointer', () => {
    const { container } = render(
      <OrnamentalFrame>
        <a href="/hotels">Hotels</a>
      </OrnamentalFrame>
    )

    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg.getAttribute('class')).toContain('pointer-events-none')
    }
    // The frame must never sit between the reader and what it frames.
    expect(screen.getByRole('link', { name: 'Hotels' })).toBeInTheDocument()
  })
})

describe('MandalaDivider', () => {
  it('renders decoratively, with a default size a caller can override', () => {
    const { container, rerender } = render(<MandalaDivider />)
    const svg = () => container.querySelector('svg')!

    expect(svg()).toHaveAttribute('aria-hidden', 'true')
    expect(svg().getAttribute('class')).toContain('h-6 w-40')

    rerender(<MandalaDivider className="mx-auto text-gold" />)
    expect(svg().getAttribute('class')).toContain('mx-auto text-gold')
  })
})
