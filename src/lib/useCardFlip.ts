import React from 'react'

export const FLIP_MS = 700

/**
 * The two-face 3D page turn the invitation cards use, as a hook.
 *
 * Reimplemented rather than lifted: Invite.tsx owns the same mechanism inline
 * (around its `navigate`), tangled together with the envelope phases, the zoom
 * geometry and the morphing next button, with no seam to pull it out through.
 * That file is left alone.
 *
 * Three things carry the whole trick:
 *
 * - `rotation` **accumulates** (…-180, 0, 180, 360…) and is never reset, so
 *   going back genuinely un-spins instead of spinning forward again.
 * - Whichever face is currently hidden takes the incoming card, decided by
 *   normalising that accumulated rotation.
 * - `flipping` doubles as the input gate and the transition on/off switch, so
 *   the index can be moved without the card visibly snapping when it is idle.
 *
 * State is mirrored into refs so `goTo` can read the current position without
 * being rebuilt on every move, and without doing its work inside a setState
 * updater — those run twice under StrictMode.
 */
export function useCardFlip(count: number, initialIndex = 0) {
  const [index, setIndex] = React.useState(initialIndex)
  const [rotation, setRotation] = React.useState(0)
  const [faceAIndex, setFaceAIndex] = React.useState(initialIndex)
  const [faceBIndex, setFaceBIndex] = React.useState(initialIndex)
  const [flipping, setFlipping] = React.useState(false)

  const indexRef = React.useRef(initialIndex)
  const rotationRef = React.useRef(0)
  const flippingRef = React.useRef(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const goTo = React.useCallback(
    (next: number) => {
      if (next < 0 || next >= count) return
      if (next === indexRef.current || flippingRef.current) return

      const forward = next > indexRef.current
      // A shows on even half-turns; load whichever face is facing away.
      if ((((rotationRef.current % 360) + 360) % 360) === 0) setFaceBIndex(next)
      else setFaceAIndex(next)

      rotationRef.current += forward ? 180 : -180
      indexRef.current = next
      flippingRef.current = true
      setRotation(rotationRef.current)
      setIndex(next)
      setFlipping(true)

      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        flippingRef.current = false
        setFlipping(false)
      }, FLIP_MS)
    },
    [count]
  )

  // Used on first paint and for `prefers-reduced-motion`: move without spinning.
  const jumpTo = React.useCallback(
    (next: number) => {
      if (next < 0 || next >= count) return
      clearTimeout(timer.current)
      indexRef.current = next
      rotationRef.current = 0
      flippingRef.current = false
      setIndex(next)
      setFaceAIndex(next)
      setFaceBIndex(next)
      setRotation(0)
      setFlipping(false)
    },
    [count]
  )

  return { index, rotation, faceAIndex, faceBIndex, flipping, goTo, jumpTo }
}
