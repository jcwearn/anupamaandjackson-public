import React from 'react'
import { SITE_NAV_OFFSET, SITE_NAV_HEIGHT_PX } from './constants'

/**
 * How far a sticky heading has to clear, and how tall the thing above it is.
 *
 * The JumpNav bar hides on the way down the page: when it goes, the headings
 * have to take its slot, or a strip of content shows through where it used to
 * be. Headings outside a JumpNav read the default and pin under SiteNav alone,
 * as they always did.
 *
 * Split out of JumpNav.tsx because that file exports a component, and a module
 * exporting both a component and a context breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json.
 */
export const JumpNavOffset = React.createContext({
  top: SITE_NAV_OFFSET,
  pinPx: SITE_NAV_HEIGHT_PX,
})
