import React from 'react'
import { SITE_ORIGIN } from '../lib/constants'
import CopyButton from '../components/CopyButton'

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

// The gate, the page chrome and "Forget this device" all live in AdminLayout;
// this renders only what is behind them.
const InviteLinks: React.FC = () => (
  <>
    <h2 className="font-display text-2xl text-rosewood">The Invitation as a Web Page</h2>
    <p className="mt-2 text-sm text-zeus/70">
      Every version of the invitation, and who each one is for.
    </p>
    <ul className="mt-4 flex flex-col gap-4">
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
              <CopyButton value={url} />
            </div>
          </li>
        )
      })}
    </ul>

    <h2 className="mt-12 font-display text-2xl text-rosewood">The Invitation as a PDF</h2>
    <p className="mt-2 text-sm text-zeus/70">
      The same six pages the links above show, for sending to anyone who'd rather have a file than a
      web page.
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
          <CopyButton value={`${SITE_ORIGIN}${file}`} />
        </li>
      ))}
    </ul>
  </>
)

export default InviteLinks
