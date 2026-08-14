import React from 'react'
import { CopyIcon, CheckIcon } from '../icons/CopyIcon'

// Copies a deep link to the surrounding heading. Hidden until something above
// it is hovered: put `group/copy` on whichever element should reveal it — a
// <summary> in TravelTips, a whole card in HotelCard.
const CopyLinkButton: React.FC<{ id: string; label: string }> = ({ id, label }) => {
  const [copied, setCopied] = React.useState(false)

  const copy = (e: React.MouseEvent) => {
    // Inside a <summary> any click would toggle the disclosure; harmless
    // elsewhere.
    e.preventDefault()
    e.stopPropagation()
    // Keep the query string: Kerala Itinerary holds the guest's chosen
    // itinerary there, and dropping it would copy a link to a different trip
    // than the one on screen.
    const { origin, pathname, search } = window.location
    void navigator.clipboard.writeText(`${origin}${pathname}${search}#${id}`)
    setCopied(true)
  }

  React.useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Link copied' : `Copy link to ${label}`}
      className="shrink-0 cursor-pointer rounded p-1 text-rosewood/60 opacity-0 transition-opacity hover:text-rosewood focus-visible:opacity-100 group-hover/copy:opacity-100"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-fern" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  )
}

export default CopyLinkButton
