export type NavItem = { to: string; label: string }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Our Wedding' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/hotels', label: 'Hotels' },
  { to: '/travel', label: 'Travel' },
  // Labelled "FAQ" rather than "Questions & Answers": this row is what decides
  // SiteNav's `nav` breakpoint, and a long label here pushes the hamburger up
  // the width range for everyone.
  { to: '/faq', label: 'FAQ' },
  // "e-Visa" rather than "e-Visa Helper": this row is what decides SiteNav's
  // `nav` breakpoint, and the short label buys back width for everyone.
  { to: '/evisa', label: 'e-Visa' },
  // The eighth link is what pushed the `nav` breakpoint from 880px to 960px —
  // see tailwind.config.ts before adding a ninth or lengthening this label.
  { to: '/bookshelf', label: 'Bookshelf' },
]

export const KERALA_NAV_ITEM: NavItem = { to: '/kerala-itinerary', label: 'Kerala Itinerary' }

// The second-level row TravelLayout pins under SiteNav. Labels are shorter than
// the page titles they lead to: four chips have to sit side by side at 390px,
// which is why /travel/food is "Food" and not "What to Eat". Measured at 390px
// the row fills 371 of the 374px inside the bar's padding — there is no slack
// left for a fifth chip or a longer label.
export const TRAVEL_NAV_ITEMS: NavItem[] = [
  { to: '/travel', label: 'Getting Here' },
  { to: '/travel/tips', label: 'Travel Tips' },
  { to: '/travel/hyderabad', label: 'Things to Do' },
  { to: '/travel/food', label: 'Food' },
]
