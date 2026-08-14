import React from 'react'
import { CopyIcon, CheckIcon } from '../../icons/CopyIcon'

/**
 * One value the guest has to reproduce exactly on the portal: the field's label
 * as it is worded there, the value, and a button that puts it on the clipboard.
 *
 * The button is visible rather than hover-revealed the way CopyLinkButton's is —
 * copying is the whole point of these boxes, not an extra — and there is nothing
 * to hover on a phone.
 *
 * `value` is what gets copied and `children` is what gets rendered, so the two
 * can differ: the reference phone number shows its punctuation via CSS
 * pseudo-elements and keeps only the digits in the DOM, and copying it has to
 * pick up the digits alone. Callers that don't need the split can omit
 * `children`.
 */
const CopyField: React.FC<{
  label: string
  value: string
  hint?: string
  children?: React.ReactNode
}> = ({ label, value, hint, children }) => {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const copy = () => {
    void navigator.clipboard.writeText(value)
    setCopied(true)
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-lily/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-zeus/60">{label}</p>
      {/* The button shares the value's line rather than sitting up beside the
          label: it copies the value, and reading level with it says so. The
          label spans the full width above so a long value still gets it all. */}
      <div className="flex items-center justify-between gap-2">
        {/* min-w-0 so a long value wraps inside the box instead of pushing the
            button out past its edge. select-all stays — it's still the fastest
            way to grab part of a value, and the fallback wherever the clipboard
            API isn't available. */}
        <p className="min-w-0 select-all text-sm font-medium text-zeus">{children ?? value}</p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          className="shrink-0 cursor-pointer rounded p-1 text-rosewood/70 transition-colors hover:text-rosewood focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        >
          {copied ? <CheckIcon className="h-4 w-4 text-fern" /> : <CopyIcon className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-zeus/60">{hint}</p>}
    </div>
  )
}

export default CopyField
