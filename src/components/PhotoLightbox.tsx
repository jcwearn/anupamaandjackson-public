import React from 'react'
import type { StoryPhoto } from '../data/story'

/**
 * Full-size view of a story photo, opened by tapping its thumbnail.
 *
 * The grid crops every photo to a square, so this is the only place a guest
 * sees the whole frame — hence `object-contain` and a box sized to the viewport
 * rather than to a fixed aspect.
 *
 * Escape, the backdrop, and the close button all dismiss it; the caller is
 * responsible for putting focus back on the thumbnail that opened it, the same
 * split RsvpModal and Landing already use.
 */
const PhotoLightbox: React.FC<{ photo: StoryPhoto | null; onClose: () => void }> = ({
  photo,
  onClose,
}) => {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const captionId = React.useId()

  React.useEffect(() => {
    if (!photo) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
    }
  }, [photo, onClose])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-8">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-zeus/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={captionId}
        className="animate-story-fade relative flex max-h-full flex-col items-center gap-3"
      >
        <div className="rounded-lg bg-white/80 p-1.5 ring-1 ring-gold/60">
          <picture>
            <source type="image/webp" srcSet={photo.webp} />
            <img
              src={photo.src}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              className="max-h-[75vh] w-auto max-w-full rounded object-contain"
            />
          </picture>
        </div>
        <p id={captionId} className="font-body text-sm text-cream">
          {photo.caption ?? photo.alt}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-full bg-cream/90 px-5 py-2 font-body text-sm font-medium text-zeus transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default PhotoLightbox
