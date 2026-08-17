import React from 'react'
import { Outlet } from 'react-router-dom'
import AdminUnlockNotice, { AdminForgetButton } from '../components/AdminUnlockNotice'
import GuestGateNotice from '../components/GuestGateNotice'
import NotForYouNotice from '../components/NotForYouNotice'
import SectionNav from '../components/SectionNav'
import { useAdminUnlock } from '../lib/adminUnlock'
import type { AdminContext } from '../lib/adminContext'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { ADMIN_NAV_ITEMS } from '../lib/navItems'
import { AnchorScrollMt, ANCHOR_SCROLL_MT_UNDER_SECTION_NAV } from '../lib/anchorOffset'

/**
 * The gate the admin tools sit behind, and the only place it is written.
 *
 * Both tools used to run this ladder themselves, which meant unlocking twice to
 * use both and two copies of the wording to keep in step. Hoisting it here is
 * also what makes /admin a place rather than a pair of unlisted URLs: one
 * passphrase opens the section, and the chip row moves between the tools inside
 * it.
 *
 * Nests inside SiteLayout, which is not incidental — SiteLayout mounts the
 * GuestScheduleProvider that the `admin` tag gate below reads, and an admin
 * route parked anywhere else is permanently locked.
 */
const AdminLayout: React.FC = () => {
  const { isAdmin, status: guestStatus, displayName, signOut } = useGuestScheduleContext()
  const unlock = useAdminUnlock()

  // 'loading' is the prerendered default and 'resolving' covers the index fetch
  // and the guest PBKDF2 after it, so isAdmin being false says nothing yet.
  // Rendering a gate here is a guess an admin who is already known to the site
  // watches get corrected — the same flash AdminUnlockNotice returns null to
  // avoid, one gate further down.
  if (guestStatus === 'loading' || guestStatus === 'resolving') {
    return <AdminShell />
  }

  if (guestStatus === 'identified' && !isAdmin) {
    return (
      <AdminShell>
        <NotForYouNotice
          displayName={displayName}
          onSignOut={signOut}
          audience="the family keeping track of the guest list"
        />
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell>
        <GuestGateNotice
          lockedBlurb="This section is just for family — unlock it to see the admin tools."
          unlockLabel="Unlock This Page"
          unlockCopy={{
            heading: 'Who are you?',
            blurb: 'Enter your name to open the admin tools.',
          }}
        />
      </AdminShell>
    )
  }

  if (unlock.status !== 'unlocked') {
    return (
      <AdminShell>
        <AdminUnlockNotice
          status={unlock.status}
          onUnlock={unlock.unlock}
          blurb="One more step — enter the admin passphrase to open the admin tools."
        />
      </AdminShell>
    )
  }

  return (
    // The chip row only exists past the gate: it names the tools, so rendering
    // it to a locked-out guest would answer the question the gate is asking.
    <AnchorScrollMt.Provider value={ANCHOR_SCROLL_MT_UNDER_SECTION_NAV}>
      <SectionNav items={ADMIN_NAV_ITEMS} label="Admin section" />
      <AdminShell>
        <div className="font-body">
          <Outlet context={{ summary: unlock.summary } satisfies AdminContext} />
          <AdminForgetButton onForget={unlock.forget} />
        </div>
      </AdminShell>
    </AnchorScrollMt.Provider>
  )
}

/**
 * The page chrome, shared by the gate states and the tools alike so the heading
 * doesn't shift when the passphrase lands. Childless while the lookup is still
 * out, which is the whole of what a visitor sees until it comes back.
 */
const AdminShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-peach/20 px-4 pb-16">
    <div className="mx-auto max-w-2xl">
      <header className="py-12 text-center">
        <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Admin</h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-zeus/80">
          The tools for running the guest list.
        </p>
      </header>
      {children}
    </div>
  </div>
)

export default AdminLayout
