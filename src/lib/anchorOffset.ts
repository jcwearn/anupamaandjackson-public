import React from 'react'

// Where a deep-linked anchor comes to rest. Under SiteNav alone on most pages;
// under SiteNav *and* a SectionNav bar on pages that have one, or the heading
// lands behind the bar instead of below it.
//
// Both spelled out as literals because Tailwind needs the class statically —
// the same constraint HotelCard.tsx and JumpNav.tsx already document. Keep them
// in step with SiteNav's h-20 (5rem) and SectionNav's h-12 (3rem).
export const ANCHOR_SCROLL_MT = 'scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)]'
export const ANCHOR_SCROLL_MT_UNDER_SECTION_NAV =
  'scroll-mt-[calc(env(safe-area-inset-top,0px)+8rem)]'

/**
 * The scroll offset anchors on this page should use.
 *
 * A context rather than a prop because the pages that need the larger offset
 * (the Travel section) share their anchor components — Disclosure, PlaceCard,
 * IconHeading — with pages that don't. TravelLayout provides it once; everything
 * beneath picks it up without every caller having to know which layout it's in.
 */
export const AnchorScrollMt = React.createContext(ANCHOR_SCROLL_MT)
