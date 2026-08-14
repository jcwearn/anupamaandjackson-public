import React from 'react'
import type { SitePhoto } from '../data/photo'

// The gold mat every photo on the food page sits in — the Landing hero's
// treatment, with a thinner mat because these mostly hang inside a `card`
// that already has its own border. One component so two dozen pictures can't
// drift apart on rounding, lazy-loading or the webp fallback.
const PhotoFrame: React.FC<{
  photo: SitePhoto
  /** Static Tailwind aspect class, e.g. 'aspect-[3/2]' — crops via object-cover. */
  aspect: string
  /** 'arch' rounds the top into the arch the Landing hero wears. */
  shape?: 'rect' | 'arch'
  /** The header images load before any scrolling; everything else can wait. */
  eager?: boolean
  className?: string
}> = ({ photo, aspect, shape = 'rect', eager = false, className = '' }) => {
  const matShape = shape === 'arch' ? 'rounded-t-full rounded-b-lg' : 'rounded-lg'
  const imgShape = shape === 'arch' ? 'rounded-t-full rounded-b-md' : 'rounded-md'

  return (
    <div className={`bg-white/70 p-1 ring-1 ring-gold/60 ${matShape} ${className}`}>
      <picture>
        {photo.webp && <source srcSet={photo.webp} type="image/webp" />}
        <img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          className={`${aspect} w-full object-cover ${imgShape}`}
        />
      </picture>
    </div>
  )
}

export default PhotoFrame
