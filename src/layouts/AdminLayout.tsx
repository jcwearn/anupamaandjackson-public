import React from 'react'
import { Outlet } from 'react-router-dom'
import GuestGateNotice from '../components/GuestGateNotice'
import NotForYouNotice from '../components/NotForYouNotice'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'

/**
 * The gate in front of /admin, and the only place it is written.
 *
 * There used to be a second gate behind this one: an admin passphrase that
 * unlocked the guest roster and the Kerala books, both shipped encrypted inside
 * the public schedule index. The tools that read them now live in Wedding HQ,
 * behind Cloudflare Access, and the passphrase went with them — a short secret
 * guarding a file anyone could download was the weakest lock on the site. What
 * is left here is a page of links, so the `admin` tag alone is enough: it decides
 * who sees the way in, and HQ's own login decides who gets through.
 *
 * Nests inside SiteLayout, which is not incidental — SiteLayout mounts the
 * GuestScheduleProvider that the `admin` tag gate below reads, and an admin
 * route parked anywhere else is permanently locked.
 */
const AdminLayout: React.FC = () => {
  const { isAdmin, status: guestStatus, displayName, signOut } = useGuestScheduleContext()

  // 'loading' is the prerendered default and 'resolving' covers the index fetch
  // and the guest PBKDF2 after it, so isAdmin being false says nothing yet.
  // Rendering a gate here is a guess an admin who is already known to the site
  // watches get corrected.
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

  return (
    <AdminShell>
      <div className="font-body">
        <Outlet />
      </div>
    </AdminShell>
  )
}

/**
 * The page chrome, shared by the gate states and the hub alike so the heading
 * doesn't shift when the lookup lands. Childless while the lookup is still out,
 * which is the whole of what a visitor sees until it comes back.
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
