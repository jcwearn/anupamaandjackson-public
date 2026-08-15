import React from 'react'
import CopyLinkButton from './CopyLinkButton'
import { JumpNavOffset } from '../lib/jumpNavOffset'

// `anchorId` is opt-in: pass it only where the surrounding section actually has
// that id, and a copy-link button appears. `centered` is opt-in too — Hotels and
// Kerala Itinerary share this component and keep their left-aligned headings.
//
// Where this pins comes from JumpNavOffset: under SiteNav alone by default, and
// under a JumpNav bar too on pages that have one — which moves as that bar hides
// and returns. Both halves come from the same place deliberately: the CSS offset
// parks the bar, the px one decides when its opaque background arrives, and out
// of step page content shows through underneath for a beat.
const StickySectionHeading: React.FC<{
  /** A node rather than a string: the schedule's venue eyebrow is a map link. */
  eyebrow?: React.ReactNode
  title: string
  anchorId?: string
  centered?: boolean
}> = ({ eyebrow, title, anchorId, centered = false }) => {
  const { top: stickyTop, pinPx: pinOffsetPx } = React.useContext(JumpNavOffset)
  const [stuck, setStuck] = React.useState(false)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // CSS has no :stuck selector, so watch a sentinel just above the sticky bar:
  // once it scrolls past the sticky pin point (the bottom edge of whatever is
  // fixed above, not the true viewport top) the bar is pinned. rootMargin
  // shrinks the observed area by that same amount so isIntersecting flips
  // exactly when the CSS `top` offset does.
  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Entries can batch several threshold crossings (e.g. rotate + scroll);
        // only the newest reflects current state. Pinned only when the sentinel
        // has scrolled off the TOP of the (nav-shrunk) viewport — a sentinel
        // below it also fails isIntersecting but isn't pinned.
        const entry = entries[entries.length - 1]
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < pinOffsetPx)
      },
      { rootMargin: `-${pinOffsetPx}px 0px 0px 0px` },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [pinOffsetPx])

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div
        className={`sticky z-10 -mt-3 py-3 transition-[background-color,box-shadow,top] duration-200 ${
          stuck ? 'bg-peach shadow-[0_2px_12px_rgba(105,49,62,0.12)]' : ''
        }`}
        style={{ top: stickyTop }}
      >
        <div className={`group/copy mx-auto max-w-2xl px-4 ${centered ? 'text-center' : ''}`}>
          {eyebrow && <p className="text-xs uppercase tracking-wide text-zeus/60">{eyebrow}</p>}
          {/* text-center alone does nothing to a flex item, so centring has to
              override justify-between as well. */}
          <div
            className={`mt-1 flex items-center gap-4 ${
              centered ? 'justify-center' : 'justify-between'
            }`}
          >
            <h2 className="font-display text-2xl text-rosewood">{title}</h2>
            {anchorId && <CopyLinkButton id={anchorId} label={title} />}
          </div>
        </div>
      </div>
    </>
  )
}

export default StickySectionHeading
