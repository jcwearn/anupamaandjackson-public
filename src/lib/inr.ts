/**
 * Rupee-to-dollar conversion for the Kerala pricing tables.
 *
 * Split out of KeralaItinerary.tsx because that file exports a route component,
 * and a module exporting both a component and non-components breaks fast
 * refresh -- react/only-export-components, an error in .oxlintrc.json.
 */

export const INR_PER_USD = 95.31

/**
 * Rounded up, so a guest is never shown a figure below the rupees it converts.
 *
 * It used to round to nearest, and that put the page a dollar under what we
 * actually ask for: ₹47,508 is $498.46, the admin page asks the $499 that covers
 * it (see `usdToCollect`), and the guest's own card read $498. A guest quoting
 * their own page back at us would have been right and short at the same time.
 *
 * This is the whole published table and not just the four people it currently
 * matters for, because the table is where most of them read their price and a
 * card that disagreed with the cards either side of it would be worse than one
 * that is a dollar dearer. Three rows move — the full round trip to $590, the
 * full single to $945, the shortened round trip to $431 — and so does the price
 * shown to guests who already paid the old figure. That was put to the user as
 * the cost of the change and waved off: "it's a $1 [difference] and they won't
 * care". Nobody is re-invoiced over it, because what settles a payment is
 * `askedUsd` against what they were quoted, which this does not touch.
 */
export const usd = (inr: number) => `$${Math.ceil(inr / INR_PER_USD).toLocaleString('en-US')}`
