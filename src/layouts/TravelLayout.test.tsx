import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TravelLayout from './TravelLayout'
import TravelTips from '../routes/TravelTips'
import Hyderabad from '../routes/Hyderabad'
import { ANCHOR_SCROLL_MT, ANCHOR_SCROLL_MT_UNDER_SECTION_NAV } from '../lib/anchorOffset'

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Element.prototype.scrollIntoView = vi.fn()
})

// Mirrors the nesting in main.tsx and entry-server.tsx.
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<TravelLayout />}>
          <Route path="/travel/tips" element={<TravelTips />} />
          <Route path="/travel/hyderabad" element={<Hyderabad />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )

describe('TravelLayout', () => {
  it('pins the section nav above every page in the section', () => {
    renderAt('/travel/tips')

    expect(screen.getByRole('navigation', { name: 'Travel section' })).toBeInTheDocument()
  })

  // The bar occupies the 48px directly under SiteNav. Anchors that kept the
  // 5rem offset would come to rest behind it rather than below it — the whole
  // point of a deep link is that you can read what you landed on.
  it('drops deep-link anchors below the bar, not behind it', () => {
    const { container } = renderAt('/travel/tips')
    const anchored = [...container.querySelectorAll('details[id]')]

    expect(anchored.length).toBeGreaterThan(0)
    for (const el of anchored) {
      expect(el.className, `#${el.id} sits behind the section nav`).toContain(
        ANCHOR_SCROLL_MT_UNDER_SECTION_NAV
      )
      expect(el.className).not.toContain(ANCHOR_SCROLL_MT)
    }
  })

  it('applies the same offset to the place card on show', () => {
    const { container } = renderAt('/travel/hyderabad')
    const card = container.querySelector('#charminar')

    expect(card).not.toBeNull()
    expect(card!.className).toContain(ANCHOR_SCROLL_MT_UNDER_SECTION_NAV)
  })
})
