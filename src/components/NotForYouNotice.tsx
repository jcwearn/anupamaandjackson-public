import React from 'react'

interface Props {
  displayName?: string
  onSignOut: () => void
  /** Who the page is for, e.g. 'the family sharing out the invitations'. */
  audience: string
}

/**
 * The one state GuestGateNotice gets wrong on the admin pages.
 *
 * It treats `identified` as success and prints "Showing your invitation" —
 * true everywhere else on the site, where being known to us is the whole gate.
 * These pages gate on the admin tag, so a guest can be perfectly well
 * identified and still have nothing to see, and the shared notice would tell
 * them their invitation was on screen above an empty page.
 */
const NotForYouNotice: React.FC<Props> = ({ displayName, onSignOut, audience }) => (
  <div className="card mt-5 text-center">
    <p className="text-sm leading-relaxed text-zeus/80">
      {displayName ? `We know you as ${displayName}, and this` : 'This'} page isn't one of yours —
      it's just for {audience}. Everything meant for you is on the rest of the site.
    </p>
    <p className="mt-3 text-sm text-zeus/80">
      <button
        type="button"
        onClick={onSignOut}
        className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
      >
        Not you?
      </button>
    </p>
  </div>
)

export default NotForYouNotice
