/**
 * Rupee-to-dollar conversion for the Kerala pricing tables.
 *
 * Split out of KeralaItinerary.tsx because that file exports a route component,
 * and a module exporting both a component and non-components breaks fast
 * refresh -- react/only-export-components, an error in .oxlintrc.json.
 */

export const INR_PER_USD = 95.31

export const usd = (inr: number) => `$${Math.round(inr / INR_PER_USD).toLocaleString('en-US')}`
