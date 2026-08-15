import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArchFrame from './ArchFrame'

describe('ArchFrame', () => {
  it('frames its children and can carry the section anchor', () => {
    const { container } = render(
      <ArchFrame id="day-plans">
        <h2>A few ways to spend a day</h2>
      </ArchFrame>,
    )

    expect(screen.getByRole('heading', { name: 'A few ways to spend a day' })).toBeInTheDocument()
    expect(container.querySelector('#day-plans')).not.toBeNull()
  })

  it('draws the arch as two mirrored halves, not a <use href="#id">', () => {
    // Same constraint OrnamentalFrame documents: prerendered SVG can't carry
    // ids that have to match across hydration.
    const { container } = render(
      <ArchFrame>
        <p>…</p>
      </ArchFrame>,
    )
    const paths = container.querySelectorAll('path')

    expect(paths).toHaveLength(2)
    expect(paths[0].getAttribute('d')).toBe(paths[1].getAttribute('d'))
    expect(paths[1].getAttribute('transform')).toBe('translate(600,0) scale(-1,1)')
    expect(container.querySelectorAll('defs, use, [id]')).toHaveLength(0)
  })

  it('starts and ends its verticals on the frame edge', () => {
    // The content box's left and right borders carry on from where the curve
    // leaves off; if the path stopped short there would be a step in the line.
    const { container } = render(
      <ArchFrame>
        <p>…</p>
      </ArchFrame>,
    )
    const d = container.querySelector('path')!.getAttribute('d')!
    const width = Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])

    // The left half starts hard on x=0.
    expect(d).toMatch(/^M0 /)

    // And the mirror is translated by exactly the viewBox width, so the right
    // half's vertical lands on the far edge rather than short of it or past it.
    const translate = container
      .querySelectorAll('path')[1]
      .getAttribute('transform')!
      .match(/translate\((\d+),/)!

    expect(Number(translate[1])).toBe(width)
  })

  it('keeps the curve a hairline however wide the frame gets', () => {
    // Without this the stroke scales with the SVG and stops matching the 1px
    // border underneath it.
    const { container } = render(
      <ArchFrame>
        <p>…</p>
      </ArchFrame>,
    )

    for (const path of container.querySelectorAll('path')) {
      expect(path).toHaveAttribute('vector-effect', 'non-scaling-stroke')
    }
  })

  it('is decoration, so it stays out of the accessibility tree', () => {
    const { container } = render(
      <ArchFrame>
        <p>…</p>
      </ArchFrame>,
    )

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('lets a caller change the content padding', () => {
    render(
      <ArchFrame contentClassName="px-2">
        <p>Inside</p>
      </ArchFrame>,
    )

    expect(screen.getByText('Inside').parentElement!.className).toContain('px-2')
  })
})
