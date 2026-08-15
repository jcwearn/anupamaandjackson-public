import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Shelf3D from './Shelf3D'
import { books, films } from '../data/shelf'
import type { ShelfItem } from '../data/shelf'

const renderShelf = (items: ShelfItem[], variant: 'spine' | 'case') =>
  render(<Shelf3D items={items} variant={variant} pulledSlug={null} onSelect={() => {}} />)

const box = (container: HTMLElement, title: string) =>
  container.querySelector<HTMLElement>(`button[aria-label^="${title}"]`)!

/** A face is identified by the rotation that turns it out of the front board. */
const face = (item: HTMLElement, rotation: string) =>
  [...item.querySelectorAll<HTMLElement>('span')].find((s) => s.style.transform.includes(rotation))!

const flat = (value: string) => value.replace(/\s+/g, '')

/**
 * Where the seam's dark core sits along a face's own depth axis, or null if the
 * face has no seam at all.
 */
const seamPct = (background: string) => {
  const match = /rgba\(0,0,0,0\.66\)([\d.]+)%/.exec(flat(background))
  return match ? Number(match[1]) : null
}

/** The solid plastic colours in a face, as relative luminances. */
const luminances = (background: string) => {
  const out: number[] = []
  const add = (r: number, g: number, b: number) => out.push(0.2126 * r + 0.7152 * g + 0.0722 * b)
  for (const [, r, g, b] of background.matchAll(/#([\da-f]{2})([\da-f]{2})([\da-f]{2})/gi))
    add(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16))
  // jsdom may have already normalised the hexes to rgb().
  for (const [, r, g, b] of background.matchAll(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g))
    add(Number(r), Number(g), Number(b))
  return out
}

const mean = (list: number[]) => list.reduce((sum, n) => sum + n, 0) / list.length

describe('a film case', () => {
  it('closes its seam where the side and top faces meet', () => {
    const { container } = renderShelf(films, 'case')
    const item = box(container, films[0].title)

    const side = seamPct(face(item, 'rotateY(90deg)').style.background)
    const top = seamPct(face(item, 'rotateX(90deg)').style.background)

    expect(side, 'the opening edge has no seam').not.toBeNull()
    expect(top, 'the top face has no seam').not.toBeNull()
    // The two faces run their depth axis in opposite directions — the side from
    // front to back, the top from back to front — so the seam only meets itself
    // at their shared corner if the two positions are complements. Getting this
    // backwards splits the seam at the join, which is the one mistake here that
    // review will not catch.
    expect(side! + top!).toBeCloseTo(100, 5)
  })

  it('is darker along its opening edge than across its top', () => {
    const { container } = renderShelf(films, 'case')
    const item = box(container, films[0].title)

    // The top looks at the ceiling and the opening edge looks sideways into the
    // cabinet, so the top has to stay the lit one of the pair.
    const side = luminances(face(item, 'rotateY(90deg)').style.background)
    const top = luminances(face(item, 'rotateX(90deg)').style.background)

    expect(side.length).toBeGreaterThan(0)
    expect(top.length).toBeGreaterThan(0)
    expect(mean(side)).toBeLessThan(mean(top))
  })

  it('keeps every gradient square to the faces it is painted on', () => {
    const { container } = renderShelf(films, 'case')

    for (const film of films) {
      for (const span of box(container, film.title).querySelectorAll<HTMLElement>('span')) {
        for (const [, deg] of span.style.background.matchAll(/linear-gradient\((-?[\d.]+)deg/g)) {
          // A diagonal highlight painted into a face is pinned to the artwork
          // rather than to the geometry: it cannot answer the angle the box is
          // turned at, it sits still while the box animates, and it lands
          // identically on all eight cases, so it reads as a texture over the
          // shelf instead of as light. One was removed for exactly that; this
          // keeps it from coming back.
          expect(Number(deg) % 90, `${film.title} has a ${deg}deg gradient`).toBe(0)
        }
      }
    }
  })
})

describe('a book', () => {
  it('keeps a paper fore-edge, with none of the case treatment on it', () => {
    const cases = renderShelf(films, 'case')
    const shelf = renderShelf(books, 'spine')

    const caseEdge = face(box(cases.container, films[0].title), 'rotateY(90deg)').style.background
    const bookEdge = face(box(shelf.container, books[0].title), 'rotateY(90deg)').style.background

    // The thumb indent is the only radial gradient on either edge, and the seam
    // is the only place rgba(0,0,0,0.66) appears — a book's fore-edge is
    // hundreds of paper leaves and must pick up neither.
    expect(caseEdge).toMatch(/radial-gradient/)
    expect(seamPct(caseEdge)).not.toBeNull()

    expect(bookEdge).not.toMatch(/radial-gradient/)
    expect(seamPct(bookEdge)).toBeNull()
    expect(bookEdge).toMatch(/repeating-linear-gradient/)
  })
})
