// The venue's address as the two government portals want it. /evisa offers it
// as the guest's "reference in India" and /e-arrival as their "address in
// India", and both portals ask for State and District from the same dropdowns.
// It lives here rather than in either route because a route module can only
// export its component (react/only-export-components), and two copies of an
// address drift apart the first time someone corrects one of them.
//
// State and District are uppercase because that is how the portals' dropdowns
// spell them, and the guest is matching against the dropdown.
export const VENUE_NAME = 'The Golkonda Resorts and Spas'
export const VENUE_ADDRESS =
  'Sagar Mahal Complex, near Osman Sagar Lake, Gandipet, Hyderabad 500075'
export const VENUE_STATE = 'TELANGANA'
export const VENUE_DISTRICT = 'RANGAREDDI'
