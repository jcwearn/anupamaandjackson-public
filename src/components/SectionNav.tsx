import React from 'react'
import { NavLink } from 'react-router-dom'
import type { NavItem } from '../lib/navItems'
import StickyChipBar, { chipClass, useHiddenOnScrollDown } from './StickyChipBar'

/**
 * A second row of navigation for a section of the site, pinned under SiteNav and
 * hiding on the way down the page like the jump bar it shares its chrome with.
 *
 * Unlike JumpNav's chips these are routes, so the current one is decided by the
 * URL rather than by scroll position. Anything anchored beneath it needs
 * ANCHOR_SCROLL_MT_UNDER_SECTION_NAV.
 */
const SectionNav: React.FC<{ items: NavItem[]; label: string }> = ({ items, label }) => {
  const [hidden] = useHiddenOnScrollDown()

  return (
    <StickyChipBar label={label} hidden={hidden}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          viewTransition
          // Without `end` the section root matches every path beneath it, and
          // two chips would read as current at once.
          end={item.to.split('/').length === 2}
          className={({ isActive }) => chipClass(isActive)}
        >
          {item.label}
        </NavLink>
      ))}
    </StickyChipBar>
  )
}

export default SectionNav
