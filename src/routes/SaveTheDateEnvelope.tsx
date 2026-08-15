import React, { useState } from 'react'
import { FLOATING_NAV_CLEARANCE } from '../lib/constants'

// og-save-the-date.jpg is 579x800.
const CARD_ASPECT = 0.72375

const SaveTheDateEnvelope: React.FC = () => {
  const [animationState, setAnimationState] = useState<
    'closed' | 'flap-opening' | 'rising' | 'rotating' | 'complete'
  >('closed')

  const startAnimation = () => {
    if (animationState !== 'closed') return

    // Phase 1: Flap opens (0-700ms)
    setAnimationState('flap-opening')

    // Phase 2: Card rises UP (700-1500ms) - envelope stays in place
    setTimeout(() => setAnimationState('rising'), 700)

    // Phase 3: Card rotates (1500-2300ms) - envelope fades
    setTimeout(() => setAnimationState('rotating'), 1500)

    // Phase 4: Complete - details fade in (2500ms)
    setTimeout(() => setAnimationState('complete'), 2500)
  }

  const isFlapOpen = animationState !== 'closed'
  const isRising =
    animationState === 'rising' || animationState === 'rotating' || animationState === 'complete'
  const isRotating = animationState === 'rotating' || animationState === 'complete'
  const isComplete = animationState === 'complete'

  return (
    <div
      className="relative min-h-screen bg-peach/20 flex flex-col items-center justify-center px-4 overflow-x-hidden overflow-y-auto"
      style={{
        // Keep the scene clear of the FloatingNav pills and reserve a bottom
        // band for the details block that fades in after the reveal.
        paddingTop: FLOATING_NAV_CLEARANCE,
        paddingBottom: '13.5rem',
      }}
    >
      {/* Main container */}
      <div className="relative flex flex-col items-center">
        {/* Scene container with perspective. Until the reveal completes it shifts down by half the page's padding imbalance so the closed envelope sits viewport-centered, then glides up as the card settles. */}
        <div
          className="relative w-80 sm:w-96 md:w-[24rem]"
          style={{
            perspective: '1000px',
            transform: isComplete
              ? 'translateY(0)'
              : `translateY(calc((13.5rem - ${FLOATING_NAV_CLEARANCE}) / 2))`,
            transition: 'transform 800ms ease-out',
          }}
        >
          {/* Envelope container - single cohesive unit */}
          <div
            className="relative w-full transition-all ease-out"
            style={{
              aspectRatio: '4/3',
              zIndex: isRising ? 4 : 20,
              // Envelope moves down during rising so card clears the front
              // before rotating. Once complete (envelope is invisible by
              // then) it resets so the card settles at an unscaled, centered
              // position.
              transform: isComplete
                ? 'translateY(0%) scale(1)'
                : isRising
                  ? 'translateY(100%) scale(1.20)'
                  : isFlapOpen
                    ? 'scale(1.05)'
                    : 'scale(1)',
              transition: 'transform 800ms ease-out',
            }}
          >
            {/* Envelope back (gold interior) */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#d4a855] to-[#c9a44a] rounded-b-lg transition-opacity"
              style={{
                zIndex: 1,
                opacity: isRotating ? 0 : 1,
                transitionDuration: '1000ms',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10" />
            </div>

            {/* Lid Two (back, gold) - rotates 90deg → 180deg */}
            <div
              className="absolute top-0"
              style={{
                left: '-1px',
                right: '-1px',
                transformOrigin: 'top center',
                transform: isFlapOpen ? 'rotateX(180deg)' : 'rotateX(90deg)',
                transition: 'transform 350ms ease-out 350ms, opacity 1000ms ease-out',
                zIndex: 3,
                opacity: isRotating ? 0 : 1,
              }}
            >
              <div
                className="w-full bg-gradient-to-b from-[#d4a855] to-[#c9a44a]"
                style={{
                  clipPath: 'url(#lid-shape)',
                  aspectRatio: '1.9/1',
                }}
              >
                {/* SVG for rounded lid tip */}
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <clipPath id="lid-shape" clipPathUnits="objectBoundingBox">
                      {/* Triangle with rounded tip at bottom center */}
                      <path d="M 0 0 L 0.48 0.94 Q 0.5 0.98, 0.52 0.94 L 1 0 Z" />
                    </clipPath>
                  </defs>
                </svg>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/20" />
              </div>
            </div>

            {/* Envelope Front Face with V cutout - using SVG for rounded tip */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#f5e6d3] to-[#efe0cc] rounded-b-lg shadow-lg overflow-hidden transition-opacity"
              style={{
                zIndex: 10,
                clipPath: 'url(#envelope-cutout)',
                opacity: isRotating ? 0 : 1,
                transitionDuration: '1000ms',
              }}
            >
              {/* SVG for rounded V cutout clip path */}
              <svg width="0" height="0" className="absolute">
                <defs>
                  <clipPath id="envelope-cutout" clipPathUnits="objectBoundingBox">
                    {/* Rectangle with V cutout: edges at 3% and 97%, tip at 50% down to ~50% with rounded bottom */}
                    <path d="M 0 0 L 0 1 L 1 1 L 1 0 L 0.97 0 L 0.52 0.48 Q 0.5 0.52, 0.48 0.48 L 0.03 0 Z" />
                  </clipPath>
                </defs>
              </svg>

              {/* Bottom fold detail */}
              <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#e8d5c0] to-transparent rounded-b-lg" />

              {/* Left fold */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1/4 bg-gradient-to-r from-[#e8d5c0] to-transparent"
                style={{ clipPath: 'polygon(0 0, 100% 5%, 100% 80%, 0 100%)' }}
              />

              {/* Right fold */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-[#e8d5c0] to-transparent"
                style={{ clipPath: 'polygon(0 5%, 100% 0, 100% 100%, 0 80%)' }}
              />
            </div>

            {/* Card - single element inside envelope, animates through all phases */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                zIndex: 5, // Above back (1), below front (10) - visible through V cutout
                // Rises out of the envelope, then settles back to center once
                // the envelope container resets on complete.
                transform: isComplete
                  ? 'translateY(0%)'
                  : isRising
                    ? 'translateY(-120%)'
                    : 'translateY(0%)',
                transition: 'transform 800ms ease-out',
              }}
            >
              <div
                style={{
                  // Rotate only during rotating phase
                  transform: isRotating ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 800ms ease-out',
                }}
              >
                <img
                  src="/og-save-the-date.jpg"
                  alt="Save the Date - Anupama & Jackson"
                  className="rounded-lg w-[14rem] sm:w-[16rem] md:w-[17rem]"
                  style={{
                    // Height-aware final size: fills the space between the nav
                    // clearance and the details band (13.5rem + 2rem margins).
                    width: isComplete
                      ? `min(100vw - 2rem, calc((100dvh - ${FLOATING_NAV_CLEARANCE} - 15.5rem) * ${CARD_ASPECT}), 20rem)`
                      : undefined,
                    boxShadow: isRotating
                      ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                      : 'none',
                    transition:
                      'box-shadow 800ms ease-out, width 900ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
            </div>

            {/* Lid One (front, cream) - rotates 0deg → 90deg */}
            <div
              className="absolute top-0"
              style={{
                left: '-1px',
                right: '-1px',
                transformOrigin: 'top center',
                transform: isFlapOpen ? 'rotateX(90deg)' : 'rotateX(0deg)',
                transition: 'transform 350ms ease-out, opacity 1000ms ease-out',
                zIndex: isFlapOpen ? 5 : 15,
                opacity: isRotating ? 0 : 1,
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

          {/* Open Button - overlays everything */}
          <button
            onClick={startAnimation}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 cursor-pointer ${
              isFlapOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{ zIndex: 50 }}
            aria-label="Open envelope"
          >
            <span className="bg-rosewood/90 hover:bg-rosewood text-cream font-body px-6 py-3 rounded-full font-medium shadow-lg transition-colors duration-150">
              Tap to Open
            </span>
          </button>
        </div>
      </div>

      {/* Details - fade in after animation completes, anchored to the bottom band the page padding reserves */}
      <div
        className={`absolute inset-x-0 px-4 text-center transition-all duration-500 ${
          isComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ bottom: 'max(2.5dvh, 1rem)' }}
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display text-rosewood whitespace-nowrap">
          Anupama & Jackson
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-zeus">October 28, 2026 • Hyderabad, India</p>
        <p className="mt-4 text-zeus/80 text-lg italic">We can't wait to celebrate with you!</p>
        <a
          href="https://forms.gle/2EGLpXGyrbEftjEs9"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6 inline-block"
        >
          Share your contact details
        </a>
      </div>
    </div>
  )
}

export default SaveTheDateEnvelope
