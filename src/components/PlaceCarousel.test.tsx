import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlaceCarousel from './PlaceCarousel'
import { places } from '../data/places'
import { FLIP_MS } from '../lib/useCardFlip'

let reducedMotion = false

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
})

beforeEach(() => {
  reducedMotion = false
  window.location.hash = ''
})

afterEach(() => {
  window.location.hash = ''
})

const renderCarousel = () =>
  render(
    <MemoryRouter>
      <PlaceCarousel places={places} />
    </MemoryRouter>
  )

// The flip gates further input until it finishes, so a test that turns twice has
// to let the first one land.
const settle = () =>
  act(() => {
    vi.advanceTimersByTime(FLIP_MS + 10)
  })

const status = () => screen.getByText(/ — \d+ of \d+$/)

describe('PlaceCarousel', () => {
  it('starts on the first place and names where you are', () => {
    renderCarousel()

    expect(status()).toHaveTextContent(`${places[0].name} — 1 of ${places.length}`)
    // Silent otherwise: the card turns and a screen reader hears nothing.
    expect(status()).toHaveAttribute('aria-live', 'polite')
  })

  it('turns forward and back', async () => {
    vi.useFakeTimers()
    renderCarousel()

    await act(async () => {
      screen.getByRole('button', { name: 'Next place' }).click()
    })
    expect(status()).toHaveTextContent(`${places[1].name} — 2 of ${places.length}`)

    settle()
    await act(async () => {
      screen.getByRole('button', { name: 'Previous place' }).click()
    })
    expect(status()).toHaveTextContent(`${places[0].name} — 1 of ${places.length}`)

    vi.useRealTimers()
  })

  it('un-spins on the way back rather than carrying on forward', async () => {
    // The whole point of accumulating rotation: going back must retrace.
    vi.useFakeTimers()
    const { container } = renderCarousel()
    const spun = () => container.querySelector<HTMLElement>('[style*="rotateY"]')!.style.transform

    await act(async () => {
      screen.getByRole('button', { name: 'Next place' }).click()
    })
    expect(spun()).toContain('rotateY(180deg)')

    settle()
    await act(async () => {
      screen.getByRole('button', { name: 'Previous place' }).click()
    })
    expect(spun()).toContain('rotateY(0deg)')

    vi.useRealTimers()
  })

  it('shows an arrow only where there is somewhere to go', async () => {
    vi.useFakeTimers()
    renderCarousel()

    expect(screen.queryByRole('button', { name: 'Previous place' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Next place' })).toBeInTheDocument()

    await act(async () => {
      screen.getByRole('button', { name: places[places.length - 1].name }).click()
    })

    expect(screen.getByRole('button', { name: 'Previous place' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next place' })).toBeNull()

    vi.useRealTimers()
  })

  it('keeps the deck one height, so it does not grow and shrink as you turn', () => {
    // Every card is stacked in one grid cell behind the two live faces; the cell
    // is as tall as the tallest of them and stays there.
    const { container } = renderCarousel()

    expect(container.querySelectorAll('[inert] .aspect-\\[2\\/1\\]')).toHaveLength(places.length)
    // The sizer copies carry no photos — nine hidden images would be a waste.
    expect(container.querySelectorAll('[inert] img')).toHaveLength(0)
  })

  it('jumps straight to a place from its dot', async () => {
    vi.useFakeTimers()
    renderCarousel()

    await act(async () => {
      screen.getByRole('button', { name: places[4].name }).click()
    })

    expect(status()).toHaveTextContent(`${places[4].name} — 5 of ${places.length}`)
    expect(screen.getByRole('button', { name: places[4].name })).toHaveAttribute(
      'aria-current',
      'true'
    )

    vi.useRealTimers()
  })

  it('opens on whatever the fragment names', () => {
    window.location.hash = `#${places[3].slug}`
    renderCarousel()

    expect(status()).toHaveTextContent(`${places[3].name} — 4 of ${places.length}`)
  })

  it('follows the fragment when a link on the page changes it', async () => {
    vi.useFakeTimers()
    renderCarousel()

    await act(async () => {
      window.location.hash = `#${places[2].slug}`
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(status()).toHaveTextContent(`${places[2].name} — 3 of ${places.length}`)

    vi.useRealTimers()
  })

  it('writes the fragment back as you turn, so the link is always shareable', async () => {
    vi.useFakeTimers()
    renderCarousel()

    await act(async () => {
      screen.getByRole('button', { name: 'Next place' }).click()
    })

    expect(window.location.hash).toBe(`#${places[1].slug}`)

    vi.useRealTimers()
  })

  it('swaps without spinning when the reader asked for less motion', async () => {
    reducedMotion = true
    const { container } = renderCarousel()

    await act(async () => {
      screen.getByRole('button', { name: 'Next place' }).click()
    })

    expect(status()).toHaveTextContent(`${places[1].name} — 2 of ${places.length}`)
    expect(container.querySelector<HTMLElement>('[style*="rotateY"]')!.style.transform).toContain(
      'rotateY(0deg)'
    )
  })

  it('keeps the deep-link id on the face the reader can see', () => {
    // Both faces render, and on first paint they hold the same place.
    const { container } = renderCarousel()

    expect(container.querySelectorAll(`#${places[0].slug}`)).toHaveLength(1)
  })
})
