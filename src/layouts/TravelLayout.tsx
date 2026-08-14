import React from 'react'
import { Outlet } from 'react-router-dom'
import SectionNav from '../components/SectionNav'
import { TRAVEL_NAV_ITEMS } from '../lib/navItems'
import { AnchorScrollMt, ANCHOR_SCROLL_MT_UNDER_SECTION_NAV } from '../lib/anchorOffset'

// Nests inside SiteLayout: the section bar pins under SiteNav, and everything
// beneath it anchors 3rem lower to clear the bar.
const TravelLayout: React.FC = () => (
  <AnchorScrollMt.Provider value={ANCHOR_SCROLL_MT_UNDER_SECTION_NAV}>
    <SectionNav items={TRAVEL_NAV_ITEMS} label="Travel section" />
    <Outlet />
  </AnchorScrollMt.Provider>
)

export default TravelLayout
