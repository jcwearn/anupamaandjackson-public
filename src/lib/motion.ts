/**
 * Motion helpers shared by the shelf and the carousels.
 *
 * Split out of Shelf3D.tsx because that file exports a component, and a module
 * exporting both a component and non-components breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json.
 */

/** True when the reader has asked the OS to reduce motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** The idle tilt of shelf item `index`, cycling through four angles. */
export const restingDeg = (index: number) => [-26, -21, -24, -19][index % 4]
