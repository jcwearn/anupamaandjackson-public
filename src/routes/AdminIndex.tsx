import React from 'react'
import { HQ_TOOLS } from '../lib/hqTools'

/**
 * The admin hub: one card per tool, each opening its page in Wedding HQ.
 *
 * The tools themselves used to live here, fed by a passphrase-encrypted copy of
 * the roster and the Kerala books inside the public schedule index. HQ holds
 * the live versions now — editable, and behind Cloudflare Access rather than a
 * short passphrase — so this page only points at them. The old /admin/* URLs
 * redirect to the same places (public/_redirects).
 */
const AdminIndex: React.FC = () => (
  <>
    <ul className="flex flex-col gap-4">
      {HQ_TOOLS.map(({ href, title, blurb }) => (
        <li key={href}>
          {/* The whole card is the target, not a link buried in it: every one
              of these rows leads exactly one place, and a phone-sized tap
              should not have to find the underlined words. */}
          <a
            href={href}
            className="card block transition-colors hover:bg-lily/20 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            <span className="font-display text-xl text-rosewood">{title}</span>
            <span className="mt-1 block text-sm text-zeus/80">{blurb}</span>
          </a>
        </li>
      ))}
    </ul>
    <p className="mt-6 text-center text-sm text-zeus/70">
      These open in Wedding HQ, which asks for a one-time code sent to your email the first time.
    </p>
  </>
)

export default AdminIndex
