import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setKeralaInvited, useNavItems } from './useNavItems'
import { KERALA_NAV_ITEM, NAV_ITEMS } from './navItems'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

const labels = (items: { label: string }[]) => items.map((item) => item.label)

beforeEach(() => {
  window.localStorage.clear()
})

describe('useNavItems', () => {
  it('offers the standard row to a guest who has not identified themselves', () => {
    const { result } = renderHook(() => useNavItems(), { wrapper })

    expect(result.current).toEqual(NAV_ITEMS)
    expect(labels(result.current)).not.toContain(KERALA_NAV_ITEM.label)
  })

  it('adds Kerala once a guest is known to be on the trip', () => {
    setKeralaInvited(true)
    const { result } = renderHook(() => useNavItems(), { wrapper })

    expect(labels(result.current)).toContain('Kerala Itinerary')
    // Appended, so the rest of the row keeps its order.
    expect(result.current.slice(0, NAV_ITEMS.length)).toEqual(NAV_ITEMS)
  })

  it('stays within the width SiteNav was measured against', () => {
    // Eight is what SiteNav's 960px breakpoint and its 24px column gap were
    // sized against (seven links plus Bookshelf). A ninth link doesn't
    // overflow anything loudly — it quietly spends the gap and puts the row
    // back to touching the wordmark and the guest pill, so guard the count
    // rather than wait to see it.
    setKeralaInvited(true)
    const { result } = renderHook(() => useNavItems(), { wrapper })

    expect(result.current.length).toBeLessThanOrEqual(8)
  })

  it('reveals the link the moment a guest identifies themselves', () => {
    // The nav is already mounted when the lookup resolves — it must not wait
    // for a route change to notice.
    const { result } = renderHook(() => useNavItems(), { wrapper })
    expect(labels(result.current)).not.toContain('Kerala Itinerary')

    act(() => setKeralaInvited(true))

    expect(labels(result.current)).toContain('Kerala Itinerary')
  })

  it('takes the link back when a guest signs out', () => {
    setKeralaInvited(true)
    const { result } = renderHook(() => useNavItems(), { wrapper })
    expect(labels(result.current)).toContain('Kerala Itinerary')

    act(() => setKeralaInvited(false))

    expect(labels(result.current)).toEqual(labels(NAV_ITEMS))
  })

  it('hides the link again for a guest who is identified but not on the trip', () => {
    // Not merely "leave it as it was": someone can identify as one guest and
    // then as another, and the second must not inherit the first's link.
    setKeralaInvited(true)
    setKeralaInvited(false)
    const { result } = renderHook(() => useNavItems(), { wrapper })

    expect(labels(result.current)).not.toContain('Kerala Itinerary')
  })

  it('survives localStorage being unavailable', () => {
    const store = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })

    try {
      expect(() => setKeralaInvited(true)).not.toThrow()
      const { result } = renderHook(() => useNavItems(), { wrapper })
      expect(result.current).toEqual(NAV_ITEMS)
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: store })
    }
  })
})
