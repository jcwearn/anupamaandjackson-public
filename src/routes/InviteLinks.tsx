import React, { useEffect, useState } from 'react'
import AdminUnlockNotice, { AdminForgetButton } from '../components/AdminUnlockNotice'
import GuestGateNotice from '../components/GuestGateNotice'
import NotForYouNotice from '../components/NotForYouNotice'
import { useAdminUnlock } from '../lib/adminUnlock'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { SITE_ORIGIN } from '../lib/constants'
import { CopyIcon, CheckIcon } from '../icons/CopyIcon'

/**
 * The share links for the four printed-invite pages, with what each one covers.
 *
 * "Sangeet" is the With Joy tag; the event is titled Welcome Celebration &
 * Edurukolu on the schedule and its card is `edurukolu` in
 * src/data/invites.ts. The scopes below are what those card sequences actually
 * contain — the two narrowed Tadanki variants drop the edurukolu card, which is
 * the whole difference between them and the full invite.
 */
const inviteLinks = [
  {
    path: '/invites/wearn/',
    side: "Jackson's side",
    scope: 'Sangeet, Muhurtham & Reception',
  },
  {
    path: '/invites/tadanki/',
    side: "Anupama's side",
    scope: 'Sangeet, Muhurtham & Reception',
  },
  {
    path: '/invites/tadanki/reception/',
    side: "Anupama's side",
    scope: 'Muhurtham & Reception',
  },
  {
    path: '/invites/tadanki/muhurtham/',
    side: "Anupama's side",
    scope: 'Muhurtham only',
  },
]

const invitePdfs = [
  { file: '/invites/invite-tadanki.pdf', label: "Anupama's side" },
  { file: '/invites/invite-wearn.pdf', label: "Jackson's side" },
]

/**
 * Always visible, unlike the hover-revealed CopyLinkButton the content pages
 * use for heading anchors — copying is the entire point of this page.
 */
const CopyButton: React.FC<{ url: string }> = ({ url }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(url)
        setCopied(true)
      }}
      aria-label={copied ? 'Link copied' : `Copy ${url}`}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 font-body text-sm text-rosewood transition-colors hover:bg-lily/30"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-fern" /> : <CopyIcon className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

const InviteLinks: React.FC = () => {
  const { isAdmin, status, displayName, signOut } = useGuestScheduleContext()
  const unlock = useAdminUnlock()

  return (
    <div className="min-h-screen bg-peach/20 px-4 pb-16">
      <div className="mx-auto max-w-2xl">
        <header className="py-12 text-center">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Invite Links</h1>
          <p className="mt-4 font-body text-lg leading-relaxed text-zeus/80">
            Every version of the invitation, and who each one is for.
          </p>
        </header>

        {status === 'identified' && !isAdmin ? (
          <NotForYouNotice
            displayName={displayName}
            onSignOut={signOut}
            audience="the family sharing out the invitations"
          />
        ) : !isAdmin ? (
          <GuestGateNotice
            lockedBlurb="This page is just for family — unlock it to see the invite links."
            unlockLabel="Unlock This Page"
            unlockCopy={{
              heading: 'Who are you?',
              blurb: 'Enter your name to open the invite links.',
            }}
          />
        ) : unlock.status !== 'unlocked' ? (
          <AdminUnlockNotice
            status={unlock.status}
            onUnlock={unlock.unlock}
            blurb="One more step — enter the admin passphrase to see the invite links."
          />
        ) : (
          <div className="font-body">
            <ul className="flex flex-col gap-4">
              {inviteLinks.map(({ path, side, scope }) => {
                const url = `${SITE_ORIGIN}${path}`
                return (
                  <li key={path} className="card">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-zeus">{side}</span>
                      <span className="text-sm text-zeus/70">{scope}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {/* Wraps rather than truncates: every one of these URLs
                          shares the first 29 characters, so an ellipsis at the
                          right edge renders all four identical on a phone. */}
                      <a
                        href={path}
                        className="min-w-0 grow break-all text-sm text-rosewood underline decoration-rosewood/40 underline-offset-2"
                      >
                        {url}
                      </a>
                      <CopyButton url={url} />
                    </div>
                  </li>
                )
              })}
            </ul>

            <h2 className="mt-12 font-display text-2xl text-rosewood">The Invitation as a PDF</h2>
            <p className="mt-2 text-sm text-zeus/70">
              The same six pages the links above show, for sending to anyone who'd rather have a
              file than a web page.
            </p>
            <ul className="mt-4 flex flex-col gap-4">
              {invitePdfs.map(({ file, label }) => (
                <li key={file} className="card flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="grow font-medium text-zeus">{label}</span>
                  <a
                    href={file}
                    className="text-sm text-rosewood underline decoration-rosewood/40 underline-offset-2"
                  >
                    View
                  </a>
                  <a
                    href={file}
                    download
                    className="text-sm text-rosewood underline decoration-rosewood/40 underline-offset-2"
                  >
                    Download
                  </a>
                  <CopyButton url={`${SITE_ORIGIN}${file}`} />
                </li>
              ))}
            </ul>

            <AdminForgetButton onForget={unlock.forget} />
          </div>
        )}
      </div>
    </div>
  )
}

export default InviteLinks
