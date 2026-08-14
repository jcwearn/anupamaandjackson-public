// Where the site actually lives. /invites/links copies share links from this
// rather than window.location.origin, so a link copied out of `vite preview`
// isn't a localhost URL that goes nowhere for the guest who receives it.
export const SITE_ORIGIN = 'https://anupamaandjackson.com'

export const WITHJOY_URL = 'https://withjoy.com/anupama-and-jackson'
// Joy's landing page, where guests browse the schedule, registry and so on.
export const WITHJOY_HOMEPAGE_URL = `${WITHJOY_URL}/`
// The RSVP form itself. Both sit behind the same password.
export const WITHJOY_RSVP_URL = `${WITHJOY_URL}/rsvp`

// Shared with SiteLayout (content offset) and the sticky section headings so
// they can't drift apart from SiteNav's actual rendered (h-20) height.
export const SITE_NAV_OFFSET = 'calc(env(safe-area-inset-top, 0px) + 5rem)'
// Matches SITE_NAV_OFFSET so content sits flush under the solid bar with no
// strip of page background peeking out beneath it.
export const SITE_MAIN_PADDING_TOP = 'calc(env(safe-area-inset-top, 0px) + 5rem)'

// Bottom edge of FloatingNav's pills (top safe-area + 1.125rem, h-11) plus a
// 0.5rem gap. Shared with Invite and SaveTheDateEnvelope so their card layouts
// can't drift apart from FloatingNav's actual rendered geometry.
export const FLOATING_NAV_CLEARANCE = 'calc(env(safe-area-inset-top, 0px) + 4.375rem)'

// Pages with a JumpNav pin its bar directly under SiteNav, so their section
// headings have to pin under BOTH. Keep these in agreement by hand with the
// bar's own h-12 (3rem) and with JUMP_NAV_SCROLL_MT in JumpNav.tsx — Tailwind
// needs that class spelled out, so it can't read the calc() here (same
// constraint HotelCard.tsx and TravelTips.tsx already document).
export const JUMP_NAV_HEIGHT_PX = 48
export const JUMP_NAV_SECTION_TOP = 'calc(env(safe-area-inset-top, 0px) + 8rem)'

// Numeric px equivalent of SiteNav's h-20 row, for JS scroll-position math
// (e.g. IntersectionObserver rootMargin) that can't consume the calc()/env()
// string above. Safe-area-inset-top is assumed 0 here, consistent with the
// rest of this file.
export const SITE_NAV_HEIGHT_PX = 80
