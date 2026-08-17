/**
 * The three group flights, and their legs.
 *
 * Split out of KeralaItinerary.tsx for the reason inr.ts and keralaPricing.ts
 * were: that file exports a route component, and a module exporting both a
 * component and non-components breaks fast refresh -- react/only-export-components,
 * an error in .oxlintrc.json.
 *
 * /admin/kerala-trip is the second reader. The headcount per date it sends the
 * travel agent is counted off these rows rather than typed out beside them, so
 * a rescheduled leg cannot leave us confirming a date the site no longer shows.
 */

export type KeralaFlight = {
  trips: ('full' | 'short')[]
  leg: 'out' | 'return'
  scope: string
  // ISO, so the cards can be ordered by it and the weekday can't contradict it.
  date: string
  // Absent until the booking exists; the card renders a placeholder instead.
  number?: string
  from: { code: string; city: string; time?: string }
  to: { code: string; city: string; time?: string }
}

// Times are stored as the airline prints them, so the duration and the 12-hour
// display are both derived — they can't drift from each other or the ticket.
export const flights: KeralaFlight[] = [
  {
    trips: ['full', 'short'],
    leg: 'out',
    scope: 'Both itineraries',
    date: '2026-10-29',
    number: 'IndiGo 6E 6682',
    from: { code: 'HYD', city: 'Hyderabad', time: '14:15' },
    to: { code: 'COK', city: 'Kochi', time: '15:55' },
  },
  {
    trips: ['full'],
    leg: 'return',
    scope: 'Full itinerary',
    date: '2026-11-01',
    number: 'IndiGo 6E 951',
    from: { code: 'COK', city: 'Kochi', time: '13:49' },
    to: { code: 'HYD', city: 'Hyderabad', time: '15:15' },
  },
  {
    trips: ['short'],
    leg: 'return',
    scope: 'Shortened itinerary',
    date: '2026-10-31',
    number: 'IndiGo 6E 6681',
    from: { code: 'COK', city: 'Kochi', time: '16:25' },
    to: { code: 'HYD', city: 'Hyderabad', time: '18:00' },
  },
]
