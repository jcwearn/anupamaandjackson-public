import React, { useEffect, useState } from 'react'
import { CopyIcon, CheckIcon } from '../icons/CopyIcon'

/**
 * Always visible, unlike the hover-revealed CopyLinkButton the content pages
 * use for heading anchors — on the admin tools copying is the entire point.
 *
 * `compact` drops the word beside the icon. /admin/guest-summary sets it below
 * `sm`, where the button shares a table row with a name and three event columns
 * and the label is what tips that row into scrolling sideways. The aria-label
 * carries the meaning either way, so nothing is lost but the width.
 *
 * `label` names what is being copied when the value itself will not do.
 * /admin/kerala-trip copies a ten-line message to the travel agent, and an
 * aria-label that reads the whole thing out is worse than no label at all.
 */
const CopyButton: React.FC<{ value: string; label?: string; compact?: boolean }> = ({
  value,
  label,
  compact,
}) => {
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
        void navigator.clipboard.writeText(value)
        setCopied(true)
      }}
      aria-label={copied ? `${label ?? 'Link'} copied` : `Copy ${label ?? value}`}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 font-body text-sm text-rosewood transition-colors hover:bg-lily/30"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-fern" /> : <CopyIcon className="h-4 w-4" />}
      {/* Both words stacked in one grid cell, so the button is always as wide as
          the longer of them. Swapping the text alone re-widths the button, and
          in a table that re-widths the whole column and shunts every other
          column sideways for the 1.5s the confirmation is up. */}
      <span className={`grid ${compact ? 'hidden sm:grid' : ''}`}>
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          Copied
        </span>
        <span className="col-start-1 row-start-1">{copied ? 'Copied' : 'Copy'}</span>
      </span>
    </button>
  )
}

export default CopyButton
