import React, { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { inviteVariants, type InviteCard, type InviteVariant } from '../data/invites'
import type { FloatingNavOutletContext } from '../layouts/FloatingNavLayout'
import RsvpModal from '../components/RsvpModal'
import { FLOATING_NAV_CLEARANCE } from '../lib/constants'

// Top margin of the settled card: the usual breathing room, but never inside
// the FloatingNav pills. The bottom margin stays max(4dvh, 1.5rem), so the
// margins are asymmetric on short viewports.
const CARD_TOP_MARGIN = `max(4dvh, ${FLOATING_NAV_CLEARANCE})`

// Probe drives preload URLs only; rendering uses <picture> negotiation.
const AVIF_PROBE =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='

let avifSupportPromise: Promise<boolean> | null = null
const supportsAvif = (): Promise<boolean> => {
  if (!avifSupportPromise) {
    avifSupportPromise = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.width > 0 && img.height > 0)
      img.onerror = () => resolve(false)
      img.src = AVIF_PROBE
    })
  }
  return avifSupportPromise
}

const preloadPromises = new Map<string, Promise<void>>()
const preloadCompleted = new Set<string>()
const preloadCard = (name: string): Promise<void> => {
  let promise = preloadPromises.get(name)
  if (!promise) {
    promise = (async () => {
      const useAvif = await supportsAvif()
      const url = useAvif ? `/invites/${name}.avif` : `/invites/${name}.jpeg`
      await new Promise<void>((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = url
      })
      preloadCompleted.add(name)
    })()
    preloadPromises.set(name, promise)
  }
  return promise
}

type InviteImageProps = {
  card: InviteCard
  zoomed: boolean
  isRotating: boolean
  ariaHidden?: boolean
  style?: React.CSSProperties
}

const InviteImage: React.FC<InviteImageProps> = ({
  card,
  zoomed,
  isRotating,
  ariaHidden,
  style,
}) => (
  <picture style={{ display: 'contents' }}>
    <source type="image/avif" srcSet={`/invites/${card.name}.avif`} />
    <img
      src={`/invites/${card.name}.jpeg`}
      alt={card.alt}
      aria-hidden={ariaHidden}
      decoding="async"
      className="block w-full"
      style={{
        borderRadius: zoomed ? 0 : '0.5rem',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        boxShadow: isRotating
          ? '0 20px 35px -5px rgb(0 0 0 / 0.18), 0 10px 15px -6px rgb(0 0 0 / 0.12)'
          : undefined,
        transition: 'box-shadow 800ms ease-out, border-radius 900ms cubic-bezier(0.4, 0, 0.2, 1)',
        ...style,
      }}
    />
  </picture>
)

type Props = { variant: InviteVariant }

const Invite: React.FC<Props> = ({ variant }) => {
  const cards = inviteVariants[variant]
  const { setNavHidden } = useOutletContext<FloatingNavOutletContext>()

  const [animationState, setAnimationState] = useState<
    'closed' | 'flap-opening' | 'rising' | 'rotating'
  >('closed')
  const [cardIndex, setCardIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [flipping, setFlipping] = useState(false)
  const [faceAIndex, setFaceAIndex] = useState(0)
  const [faceBIndex, setFaceBIndex] = useState(0)
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [loadedCards, setLoadedCards] = useState<Set<string>>(
    () => new Set(cards.filter((c) => preloadCompleted.has(c.name)).map((c) => c.name)),
  )
  const [showLoading, setShowLoading] = useState(false)

  const rsvpTriggerRef = useRef<HTMLButtonElement>(null)
  const rsvpSideTriggerRef = useRef<HTMLButtonElement>(null)
  const rsvpInlineTriggerRef = useRef<HTMLButtonElement>(null)
  const rsvpCardTriggerRef = useRef<HTMLDivElement>(null)
  const lastRsvpTriggerRef = useRef<'bottom' | 'side' | 'inline' | 'card'>('bottom')

  // RsvpModal handles Escape/scroll-lock/close-button focus; this only
  // returns focus to whichever trigger opened it.
  useEffect(() => {
    if (!rsvpOpen) return
    // Resolved when the modal opens rather than when it closes. Which trigger
    // was used is already decided by then -- the click handler sets
    // lastRsvpTriggerRef before flipping rsvpOpen -- and reading four refs in a
    // cleanup is exactly what react-hooks/exhaustive-deps warns about, since
    // any of them can point elsewhere by the time it runs.
    const target =
      lastRsvpTriggerRef.current === 'side'
        ? rsvpSideTriggerRef.current
        : lastRsvpTriggerRef.current === 'inline'
          ? rsvpInlineTriggerRef.current
          : lastRsvpTriggerRef.current === 'card'
            ? rsvpCardTriggerRef.current
            : rsvpTriggerRef.current
    return () => target?.focus()
  }, [rsvpOpen])

  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  useEffect(() => {
    if (!revealed || rsvpOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigate(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigate(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, rsvpOpen, cardIndex, flipping, rotation, loadedCards])

  // Fade the floating hamburger out while zoomed on mobile, like the controls.
  useEffect(() => {
    setNavHidden(zoomed && !isDesktop)
    return () => setNavHidden(false)
  }, [zoomed, isDesktop, setNavHidden])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let cancelled = false

    cards.forEach((card) => {
      preloadCard(card.name).then(() => {
        if (cancelled) return
        setLoadedCards((prev) => {
          if (prev.has(card.name)) return prev
          const next = new Set(prev)
          next.add(card.name)
          return next
        })
      })
    })

    const t = window.setTimeout(() => {
      if (!cancelled) setShowLoading(true)
    }, 500)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [cards])

  const coverReady = loadedCards.has(cards[0].name)
  const isFirstCard = cardIndex === 0
  const isLastCard = cardIndex === cards.length - 1
  const nextCardReady = isLastCard || loadedCards.has(cards[cardIndex + 1].name)
  const isLoadingNext = !isLastCard && !nextCardReady && showLoading

  const startAnimation = () => {
    if (!coverReady) return
    if (animationState !== 'closed') return
    setAnimationState('flap-opening')
    setTimeout(() => setAnimationState('rising'), 700)
    setTimeout(() => setAnimationState('rotating'), 1500)
    setTimeout(() => setRevealed(true), 2500)
  }

  const toggleZoom = () => {
    if (!revealed || flipping) return
    setZoomed((z) => !z)
  }

  const navigate = (delta: number) => {
    if (!revealed || flipping) return
    const nextIndex = cardIndex + delta
    if (nextIndex < 0 || nextIndex >= cards.length) return
    if (delta > 0 && !nextCardReady) return

    const isAForward = ((rotation % 360) + 360) % 360 === 0
    if (isAForward) setFaceBIndex(nextIndex)
    else setFaceAIndex(nextIndex)

    setCardIndex(nextIndex)
    setFlipping(true)
    setRotation(rotation + (delta > 0 ? 180 : -180))

    setTimeout(() => setFlipping(false), 700)
  }

  const isFlapOpen = animationState !== 'closed'
  const isRising = animationState === 'rising' || animationState === 'rotating'
  const isRotating = animationState === 'rotating'

  // Envelope container animates: closed → scaled slightly → rose down during rise → reset for reveal.
  const envelopeContainerTransform = revealed
    ? 'translateY(0%) scale(1)'
    : isRising
      ? 'translateY(100%) scale(1.20)'
      : isFlapOpen
        ? 'scale(1.05)'
        : 'scale(1)'

  // Card container animates: in envelope → risen up → settled at viewer position.
  const cardContainerTransform = revealed
    ? 'translateY(0%)'
    : isRising
      ? 'translateY(-120%)'
      : 'translateY(0%)'

  const envelopeHidden = revealed || isRotating

  return (
    <div className="min-h-dvh bg-peach/20 relative overflow-hidden">
      {/* Envelope scene - centers in viewport when closed; when revealed, its bottom reserves a band for the carousel controls. The scene's top offset shifts the flex-centered card down so its viewport top margin is CARD_TOP_MARGIN (clear of the FloatingNav pills) while its bottom margin stays max(4dvh, 1.5rem); zoom keeps the full-bleed top. */}
      <div
        className={`absolute left-0 right-0 flex items-center justify-center ${
          zoomed && !isDesktop ? 'px-0' : 'px-4'
        } [--card-band:7.5rem] [@media(max-height:750px)]:[--card-band:6.5rem] [--nav-top:calc(max(4dvh,1.5rem)+3rem)] [@media(max-height:750px)]:[--nav-top:calc(max(4dvh,1.5rem)+1.875rem)]`}
        style={{
          top: zoomed ? 0 : `calc(${CARD_TOP_MARGIN} - max(4dvh, 1.5rem))`,
          bottom:
            !revealed || (zoomed && isDesktop) ? 0 : zoomed ? 'var(--nav-top)' : 'var(--card-band)',
          transition:
            'top 900ms cubic-bezier(0.4, 0, 0.2, 1), bottom 900ms cubic-bezier(0.4, 0, 0.2, 1), padding 900ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className={
            zoomed && !isDesktop
              ? 'relative w-screen'
              : 'relative w-[22rem] sm:w-[28rem] md:w-[30rem]'
          }
        >
          {/* Envelope container */}
          <div
            className="relative w-full"
            style={{
              aspectRatio: '4/3',
              zIndex: isRising ? 4 : 20,
              transform: envelopeContainerTransform,
              transition: 'transform 900ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Envelope back (gold interior) */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#d4a855] to-[#c9a44a] rounded-b-lg"
              style={{
                zIndex: 1,
                opacity: envelopeHidden ? 0 : 1,
                transition: 'opacity 700ms ease-out',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10" />
            </div>

            {/* Lid Two (back, gold) */}
            <div
              className="absolute top-0"
              style={{
                left: '-1px',
                right: '-1px',
                transformOrigin: 'top center',
                transform: isFlapOpen ? 'rotateX(180deg)' : 'rotateX(90deg)',
                transition: 'transform 350ms ease-out 350ms, opacity 700ms ease-out',
                zIndex: 3,
                opacity: envelopeHidden ? 0 : 1,
              }}
            >
              <div
                className="w-full bg-gradient-to-b from-[#d4a855] to-[#c9a44a]"
                style={{
                  clipPath: 'url(#lid-shape)',
                  aspectRatio: '1.9/1',
                }}
              >
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <clipPath id="lid-shape" clipPathUnits="objectBoundingBox">
                      <path d="M 0 0 L 0.48 0.94 Q 0.5 0.98, 0.52 0.94 L 1 0 Z" />
                    </clipPath>
                  </defs>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/20" />
              </div>
            </div>

            {/* Envelope Front Face with V cutout */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#f5e6d3] to-[#efe0cc] rounded-b-lg shadow-lg overflow-hidden"
              style={{
                zIndex: 10,
                clipPath: 'url(#envelope-cutout)',
                opacity: envelopeHidden ? 0 : 1,
                transition: 'opacity 700ms ease-out',
              }}
            >
              <svg width="0" height="0" className="absolute">
                <defs>
                  <clipPath id="envelope-cutout" clipPathUnits="objectBoundingBox">
                    <path d="M 0 0 L 0 1 L 1 1 L 1 0 L 0.97 0 L 0.52 0.48 Q 0.5 0.52, 0.48 0.48 L 0.03 0 Z" />
                  </clipPath>
                </defs>
              </svg>

              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#e8d5c0] to-transparent rounded-b-lg" />

              <div
                className="absolute left-0 top-0 bottom-0 w-1/4 bg-gradient-to-r from-[#e8d5c0] to-transparent"
                style={{ clipPath: 'polygon(0 0, 100% 5%, 100% 80%, 0 100%)' }}
              />

              <div
                className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-[#e8d5c0] to-transparent"
                style={{ clipPath: 'polygon(0 5%, 100% 0, 100% 100%, 0 80%)' }}
              />
            </div>

            {/* Card - single element; transforms + width smoothly interpolate across every phase */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                zIndex: revealed ? 30 : 5,
                transform: cardContainerTransform,
                transformStyle: 'preserve-3d',
                transition: 'transform 900ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div
                style={{
                  transform: isRotating ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 800ms ease-out',
                }}
              >
                <div
                  ref={rsvpCardTriggerRef}
                  role="button"
                  tabIndex={revealed ? 0 : -1}
                  aria-pressed={isLastCard ? undefined : zoomed}
                  aria-label={
                    isLastCard ? 'RSVP' : zoomed ? 'Exit fullscreen card' : 'View card fullscreen'
                  }
                  aria-haspopup={isLastCard ? 'dialog' : undefined}
                  aria-expanded={isLastCard ? rsvpOpen : undefined}
                  onClick={() => {
                    if (!revealed || flipping) return
                    if (isLastCard) {
                      lastRsvpTriggerRef.current = 'card'
                      setRsvpOpen(true)
                    } else {
                      toggleZoom()
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!revealed || flipping) return
                      if (isLastCard) {
                        lastRsvpTriggerRef.current = 'card'
                        setRsvpOpen(true)
                      } else {
                        toggleZoom()
                      }
                    }
                  }}
                  className={revealed ? '' : 'w-[14rem] sm:w-[16rem] md:w-[17rem]'}
                  style={{
                    perspective: '1400px',
                    cursor:
                      revealed && !flipping
                        ? isLastCard
                          ? 'pointer'
                          : zoomed
                            ? 'zoom-out'
                            : 'zoom-in'
                        : undefined,
                    transition: 'width 900ms cubic-bezier(0.4, 0, 0.2, 1)',
                    ...(revealed && {
                      width: zoomed
                        ? isDesktop
                          ? 'min(100vw, 100dvh * 0.69875)'
                          : 'min(100vw, (100dvh - var(--nav-top)) * 0.69875)'
                        : `min(100vw - 2rem, calc((100dvh - var(--card-band) - ${CARD_TOP_MARGIN} - max(4dvh, 1.5rem)) * 0.69875), 40rem)`,
                    }),
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transform: `rotateY(${rotation}deg)`,
                      transition: flipping
                        ? 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)'
                        : 'none',
                    }}
                  >
                    <InviteImage card={cards[faceAIndex]} zoomed={zoomed} isRotating={isRotating} />
                    <InviteImage
                      card={cards[faceBIndex]}
                      zoomed={zoomed}
                      isRotating={isRotating}
                      ariaHidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        transform: 'rotateY(180deg)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lid One (front, cream) */}
            <div
              className="absolute top-0"
              style={{
                left: '-1px',
                right: '-1px',
                transformOrigin: 'top center',
                transform: isFlapOpen ? 'rotateX(90deg)' : 'rotateX(0deg)',
                transition: 'transform 350ms ease-out, opacity 700ms ease-out',
                zIndex: isFlapOpen ? 5 : 15,
                opacity: envelopeHidden ? 0 : 1,
              }}
            >
              <div
                className="w-full bg-gradient-to-b from-[#f0dcc6] to-[#e8d0b8] shadow-md"
                style={{
                  clipPath: 'url(#lid-shape)',
                  aspectRatio: '1.9/1',
                }}
              />
            </div>
          </div>

          {/* Tap to Open button */}
          <button
            onClick={startAnimation}
            disabled={!coverReady}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
              isFlapOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            } ${!coverReady && showLoading ? 'cursor-default' : 'cursor-pointer'}`}
            style={{ zIndex: 50 }}
            aria-label="Open envelope"
            aria-busy={!coverReady && showLoading}
          >
            <span
              className={`bg-rosewood/90 text-cream font-body px-6 py-3 rounded-full font-medium shadow-lg transition-colors duration-150 flex items-center gap-2 ${
                !coverReady && showLoading ? '' : 'hover:bg-rosewood'
              }`}
            >
              {!coverReady && showLoading ? (
                <>
                  <span
                    className="block w-4 h-4 rounded-full border-2 border-peach/30 border-t-peach animate-spin"
                    aria-hidden="true"
                  />
                  Loading invitation…
                </>
              ) : (
                'Tap to Open'
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Carousel controls - anchored near the viewport bottom, fade in with the reveal */}
      <div
        className={`absolute left-0 right-0 flex flex-col items-center gap-2.5 transition-opacity duration-700 ${
          revealed && !(zoomed && isDesktop) ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ bottom: 'max(2.5dvh, 1rem)' }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            // The zoom drop lands the row's top exactly on the zoomed card's
            // bottom (var(--nav-top)), matching where the pre-tightening
            // layout (gap-4, bottom max(4dvh, 1.5rem)) put it.
            transform:
              zoomed && !isDesktop
                ? 'translateY(calc(max(2.5dvh, 1rem) + 3.75rem - max(4dvh, 1.5rem)))'
                : 'translateY(0)',
            transition: 'transform 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <button
            onClick={() => navigate(-1)}
            aria-hidden={isFirstCard}
            tabIndex={isFirstCard || (zoomed && isDesktop) ? -1 : 0}
            aria-label="Previous event"
            className="rounded-full font-medium text-zeus bg-white/80 hover:bg-white shadow-sm whitespace-nowrap overflow-hidden"
            style={{
              opacity: isFirstCard ? 0 : 1,
              maxWidth: isFirstCard ? '0' : '12rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              paddingLeft: isFirstCard ? 0 : '1.25rem',
              paddingRight: isFirstCard ? 0 : '1.25rem',
              marginRight: isFirstCard || (isLastCard && !(zoomed && !isDesktop)) ? 0 : '1rem',
              transform: isFirstCard ? 'translateX(8px) scale(0.92)' : 'translateX(0) scale(1)',
              pointerEvents: isFirstCard || (zoomed && isDesktop) ? 'none' : 'auto',
              transition:
                'opacity 400ms ease-out, max-width 500ms cubic-bezier(0.4, 0, 0.2, 1), padding 500ms cubic-bezier(0.4, 0, 0.2, 1), margin 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 400ms ease-out',
            }}
          >
            ← Previous
          </button>
          <button
            ref={rsvpInlineTriggerRef}
            onClick={() => {
              if (isLastCard && zoomed && !isDesktop) {
                lastRsvpTriggerRef.current = 'inline'
                setRsvpOpen(true)
              } else {
                navigate(1)
              }
            }}
            aria-hidden={isLastCard && !(zoomed && !isDesktop)}
            aria-busy={isLoadingNext}
            tabIndex={(isLastCard && !(zoomed && !isDesktop)) || (zoomed && isDesktop) ? -1 : 0}
            aria-label={
              isLastCard && zoomed && !isDesktop
                ? 'RSVP'
                : isLoadingNext
                  ? 'Loading next event'
                  : isFirstCard
                    ? 'See your invite'
                    : 'Next event'
            }
            aria-haspopup={isLastCard && zoomed && !isDesktop ? 'dialog' : undefined}
            aria-expanded={isLastCard && zoomed && !isDesktop ? rsvpOpen : undefined}
            className={`relative rounded-full font-body font-medium shadow-lg whitespace-nowrap overflow-hidden ${
              isLoadingNext ? 'cursor-default' : 'cursor-pointer'
            } ${
              isLastCard && zoomed && !isDesktop
                ? 'bg-lily/90 hover:bg-lily text-zeus'
                : `bg-rosewood/90 ${isLoadingNext ? '' : 'hover:bg-rosewood'} text-cream`
            }`}
            style={{
              opacity: isLastCard && !(zoomed && !isDesktop) ? 0 : 1,
              maxWidth: isLastCard && !(zoomed && !isDesktop) ? '0' : '20rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              paddingLeft: isLastCard && !(zoomed && !isDesktop) ? 0 : '1.25rem',
              paddingRight: isLastCard && !(zoomed && !isDesktop) ? 0 : '1.25rem',
              transform:
                isLastCard && !(zoomed && !isDesktop)
                  ? 'translateX(-8px) scale(0.92)'
                  : 'translateX(0) scale(1)',
              pointerEvents:
                (isLastCard && !(zoomed && !isDesktop)) || (zoomed && isDesktop) ? 'none' : 'auto',
              transition:
                'opacity 400ms ease-out, max-width 500ms cubic-bezier(0.4, 0, 0.2, 1), padding 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 400ms ease-out, background-color 300ms ease-out, color 300ms ease-out',
            }}
          >
            <span className="invisible whitespace-nowrap">See your invite →</span>
            <span
              className="absolute inset-0 flex items-center justify-center gap-1 whitespace-nowrap transition-opacity duration-300"
              style={{
                opacity:
                  !(isLastCard && zoomed && !isDesktop) && isFirstCard && !isLoadingNext ? 1 : 0,
              }}
              aria-hidden={(isLastCard && zoomed && !isDesktop) || !isFirstCard || isLoadingNext}
            >
              See your invite <span className="arrow-nudge">→</span>
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center gap-1 whitespace-nowrap transition-opacity duration-300"
              style={{
                opacity:
                  !(isLastCard && zoomed && !isDesktop) && !isFirstCard && !isLoadingNext ? 1 : 0,
              }}
              aria-hidden={(isLastCard && zoomed && !isDesktop) || isFirstCard || isLoadingNext}
            >
              Next event <span className="arrow-nudge">→</span>
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: isLoadingNext ? 1 : 0 }}
              aria-hidden={!isLoadingNext}
            >
              <span
                className="block w-4 h-4 rounded-full border-2 border-peach/30 border-t-peach animate-spin"
                aria-hidden="true"
              />
              Loading…
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: isLastCard && zoomed && !isDesktop ? 1 : 0 }}
              aria-hidden={!(isLastCard && zoomed && !isDesktop)}
            >
              RSVP
            </span>
          </button>
        </div>

        <div
          className="[@media(max-height:750px)]:hidden flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Event progress"
          style={{
            opacity: zoomed && !isDesktop ? 0 : 1,
            pointerEvents: zoomed && !isDesktop ? 'none' : 'auto',
            transition:
              zoomed && !isDesktop ? 'opacity 300ms ease-out' : 'opacity 300ms ease-out 600ms',
          }}
        >
          {cards.map((_, i) => (
            <span
              key={i}
              className={`block w-2 h-2 rounded-full transition-colors duration-300 ${
                i === cardIndex ? 'bg-rosewood' : 'bg-rosewood/25'
              }`}
              aria-current={i === cardIndex ? 'true' : undefined}
            />
          ))}
        </div>

        <button
          ref={rsvpTriggerRef}
          type="button"
          onClick={() => {
            lastRsvpTriggerRef.current = 'bottom'
            setRsvpOpen(true)
          }}
          aria-haspopup="dialog"
          aria-expanded={rsvpOpen}
          aria-hidden={zoomed && !isDesktop}
          tabIndex={zoomed && !isDesktop ? -1 : 0}
          className="bg-lily/90 hover:bg-lily text-zeus rounded-full font-medium shadow-lg whitespace-nowrap cursor-pointer"
          style={{
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            paddingLeft: '1.25rem',
            paddingRight: '1.25rem',
            opacity: zoomed && !isDesktop ? 0 : 1,
            pointerEvents: zoomed && !isDesktop ? 'none' : 'auto',
            transition:
              zoomed && !isDesktop
                ? 'background-color 150ms ease-out, opacity 300ms ease-out'
                : 'background-color 150ms ease-out, opacity 300ms ease-out 600ms',
          }}
        >
          RSVP
        </button>
      </div>

      {/* Side nav - only appears while zoomed on sm: and up */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-hidden={!zoomed || isFirstCard}
        tabIndex={zoomed && !isFirstCard ? 0 : -1}
        aria-label="Previous event"
        className="hidden sm:flex absolute top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center rounded-full bg-white/80 hover:bg-white text-zeus shadow-lg transition-opacity duration-300 cursor-pointer"
        style={{
          right: 'calc(50% + min(50vw, 50dvh * 0.69875) + 2rem)',
          zIndex: 40,
          opacity: zoomed && !isFirstCard ? 1 : 0,
          pointerEvents: zoomed && !isFirstCard ? 'auto' : 'none',
        }}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <polyline points="10 4 6 8 10 12" />
        </svg>
      </button>
      <button
        ref={rsvpSideTriggerRef}
        type="button"
        onClick={() => {
          if (isLastCard) {
            lastRsvpTriggerRef.current = 'side'
            setRsvpOpen(true)
          } else {
            navigate(1)
          }
        }}
        aria-hidden={!zoomed}
        aria-busy={isLoadingNext}
        tabIndex={zoomed ? 0 : -1}
        aria-label={isLastCard ? 'RSVP' : isLoadingNext ? 'Loading next event' : 'Next event'}
        aria-haspopup={isLastCard ? 'dialog' : undefined}
        aria-expanded={isLastCard ? rsvpOpen : undefined}
        className={`hidden sm:block absolute top-1/2 -translate-y-1/2 rounded-full font-body shadow-lg ${
          isLoadingNext ? 'cursor-default' : 'cursor-pointer'
        } ${
          isLastCard
            ? 'bg-lily/90 hover:bg-lily text-zeus'
            : `bg-rosewood/90 ${isLoadingNext ? '' : 'hover:bg-rosewood'} text-cream`
        }`}
        style={{
          left: 'calc(50% + min(50vw, 50dvh * 0.69875) + 2rem)',
          zIndex: 40,
          height: '3rem',
          width: isLastCard ? '6rem' : '3rem',
          opacity: zoomed ? 1 : 0,
          pointerEvents: zoomed ? 'auto' : 'none',
          transition:
            'opacity 300ms ease-out, width 400ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease-out, color 300ms ease-out',
        }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: isLastCard || isLoadingNext ? 0 : 1 }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: isLoadingNext ? 1 : 0 }}
          aria-hidden={!isLoadingNext}
        >
          <span
            className="block w-5 h-5 rounded-full border-2 border-peach/30 border-t-peach animate-spin"
            aria-hidden="true"
          />
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center font-medium transition-opacity duration-300"
          style={{ opacity: isLastCard ? 1 : 0 }}
          aria-hidden={!isLastCard}
        >
          RSVP
        </span>
      </button>

      {/* RSVP modal: password + Joy link */}
      <RsvpModal open={rsvpOpen} onClose={() => setRsvpOpen(false)} />
    </div>
  )
}

export default Invite
