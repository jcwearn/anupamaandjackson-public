import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { FLIP_MS, useCardFlip } from './useCardFlip'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(FLIP_MS + 10)
  })

describe('useCardFlip', () => {
  it('accumulates rotation instead of toggling, so back retraces', () => {
    // If rotation flipped between 0 and 180 the card would spin the same way
    // whichever button you pressed, and going back would look like going on.
    const { result } = renderHook(() => useCardFlip(4))

    act(() => result.current.goTo(1))
    expect(result.current.rotation).toBe(180)

    settle()
    act(() => result.current.goTo(2))
    expect(result.current.rotation).toBe(360)

    settle()
    act(() => result.current.goTo(1))
    expect(result.current.rotation).toBe(180)

    settle()
    act(() => result.current.goTo(0))
    expect(result.current.rotation).toBe(0)
  })

  it('loads the card onto whichever face is turned away', () => {
    // The heart of it: put the incoming card on the hidden face, then turn.
    // Load the facing one and the reader watches it change before it moves.
    const { result } = renderHook(() => useCardFlip(4))

    // Even half-turns show face A, so B takes the next card.
    expect(result.current.rotation % 360).toBe(0)
    act(() => result.current.goTo(1))
    expect(result.current.faceBIndex).toBe(1)
    expect(result.current.faceAIndex, 'the showing face must not change').toBe(0)

    // Now B is showing, so A takes the one after.
    settle()
    act(() => result.current.goTo(2))
    expect(result.current.faceAIndex).toBe(2)
    expect(result.current.faceBIndex).toBe(1)
  })

  it('ignores a second turn until the first has landed', () => {
    // Without the gate the faces get reassigned mid-animation and the card
    // changes under the reader's eyes.
    const { result } = renderHook(() => useCardFlip(4))

    act(() => result.current.goTo(1))
    act(() => result.current.goTo(2))

    expect(result.current.index).toBe(1)
    expect(result.current.rotation).toBe(180)

    settle()
    act(() => result.current.goTo(2))
    expect(result.current.index).toBe(2)
  })

  it('reports when it is turning, which is also the transition switch', () => {
    const { result } = renderHook(() => useCardFlip(4))

    expect(result.current.flipping).toBe(false)
    act(() => result.current.goTo(1))
    expect(result.current.flipping).toBe(true)

    settle()
    expect(result.current.flipping).toBe(false)
  })

  it('stays put past either end', () => {
    const { result } = renderHook(() => useCardFlip(3))

    act(() => result.current.goTo(-1))
    expect(result.current.index).toBe(0)
    expect(result.current.rotation).toBe(0)

    act(() => result.current.goTo(3))
    expect(result.current.index).toBe(0)
  })

  it('jumps without spinning, and lands both faces on the same card', () => {
    // For arriving on a deep link and for prefers-reduced-motion: no turn, and
    // no stale card left on the back face to catch the light.
    const { result } = renderHook(() => useCardFlip(5))

    act(() => result.current.goTo(1))
    settle()
    act(() => result.current.jumpTo(4))

    expect(result.current.index).toBe(4)
    expect(result.current.rotation).toBe(0)
    expect(result.current.faceAIndex).toBe(4)
    expect(result.current.faceBIndex).toBe(4)
    expect(result.current.flipping).toBe(false)
  })

  it('can turn again straight after a jump', () => {
    // jumpTo clears the in-flight timer; if it didn't, the gate would still be
    // closed and the next turn would be swallowed.
    const { result } = renderHook(() => useCardFlip(5))

    act(() => result.current.goTo(1))
    act(() => result.current.jumpTo(3))
    act(() => result.current.goTo(4))

    expect(result.current.index).toBe(4)
    expect(result.current.rotation).toBe(180)
  })
})
