import React, { useState, useEffect, useRef } from 'react'
import heroSrc from '../assets/sangeet.jpg'
import OrnamentalFrame, { MandalaDivider } from '../components/OrnamentalFrame'
import RsvpModal from '../components/RsvpModal'
import StorySection from '../components/StorySection'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'

const Landing: React.FC = () => {
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const rsvpTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!rsvpOpen) return
    return () => rsvpTriggerRef.current?.focus()
  }, [rsvpOpen])

  return (
    // pt-4 plus SiteLayout's padding leaves ~2rem below the nav, matching pb-8
    <div className="min-h-screen bg-peach/20 px-4 pt-4 pb-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <OrnamentalFrame className="text-gold">
          <header className="text-center">
            <p className="font-body text-xs uppercase tracking-[0.25em] text-zeus/60">
              We're getting married
            </p>
            <h1 className="mt-4 font-display text-4xl text-rosewood sm:text-6xl">
              Anupama & Jackson
            </h1>
            <MandalaDivider className="mx-auto mt-5" />
            <p className="mt-4 font-body text-lg text-zeus sm:text-xl">
              October 28, 2026 • Hyderabad, India
            </p>
          </header>

          <div className="mx-auto mt-10 max-w-md rounded-t-full rounded-b-2xl bg-white/70 p-1.5 ring-1 ring-gold/60 sm:p-2">
            <img
              src={heroSrc}
              alt="Anupama and Jackson smiling together in front of a pink arch backdrop"
              className="aspect-[4/5] w-full rounded-t-full rounded-b-xl object-cover object-center"
            />
          </div>

          <p className="mx-auto mt-8 max-w-prose text-center font-body text-lg text-zeus/80">
            We can't wait to celebrate this special occasion with everyone!
          </p>

          <div className="mt-10 text-center">
            <button
              ref={rsvpTriggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={rsvpOpen}
              onClick={() => setRsvpOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-rosewood/90 px-8 py-3.5 font-body text-lg font-medium text-cream shadow-lg transition-colors hover:bg-rosewood cursor-pointer"
            >
              View more details and RSVP on Joy
              <ExternalLinkIcon className="h-5 w-5" />
            </button>
          </div>
        </OrnamentalFrame>
      </div>

      <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
        <StorySection />
      </div>

      <RsvpModal
        open={rsvpOpen}
        onClose={() => setRsvpOpen(false)}
        heading="Before you go"
        description="Use this password to view our Wedding Homepage on Joy."
        ctaLabel="View Wedding Homepage"
      />
    </div>
  )
}

export default Landing
