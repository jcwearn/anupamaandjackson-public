import clsx from 'clsx'

/**
 * The pill styling shared by every chip bar on the site.
 *
 * Split out of StickyChipBar.tsx because that file exports a component, and a
 * module exporting both a component and non-components breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json.
 */
export const chipClass = (active: boolean, { toggles = false } = {}) =>
  clsx(
    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:text-sm',
    active
      ? // A hover cue on the *active* chip is a promise that pressing it again
        // does something, so only rows where that is true ask for it. On
        // /admin/guest-summary pressing the active chip releases the filter,
        // and nothing else on that row advertises the gesture. JumpNav's and
        // SectionNav's chips are destinations: you are already there, and a
        // pill that lights up to offer you the page you are on is noise.
        //
        // Hence an opt-in rather than a blanket rule. `toggles` is the property
        // that actually decides it — not "is a button" or "is on an admin
        // page", either of which would drift the moment a third kind of chip
        // bar turns up.
        //
        // buccaneer is rosewood's darker partner elsewhere in the palette (see
        // the `text-rosewood hover:text-buccaneer` links on the Kerala page),
        // so a released chip shifts the same way the unselected ones do.
        clsx('bg-rosewood text-cream', toggles && 'hover:bg-buccaneer')
      : 'bg-lily/60 text-zeus hover:bg-lily',
  )
