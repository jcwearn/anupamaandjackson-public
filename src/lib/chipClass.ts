import clsx from 'clsx'

/**
 * The pill styling shared by every chip bar on the site.
 *
 * Split out of StickyChipBar.tsx because that file exports a component, and a
 * module exporting both a component and non-components breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json.
 */
export const chipClass = (active: boolean) =>
  clsx(
    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:text-sm',
    active ? 'bg-rosewood text-cream' : 'bg-lily/60 text-zeus hover:bg-lily',
  )
