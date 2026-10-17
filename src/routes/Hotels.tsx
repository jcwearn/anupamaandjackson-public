import React, { useCallback, useEffect, useState } from 'react'
import { GOLKONDA_SLUG, hotels } from '../data/hotels'
import { GOLKONDA_STAY_EVENT_ID, PELLIKUTHURU_EVENT_ID } from '../data/scheduleEvents'
import GolkondaStayModal from '../components/GolkondaStayModal'
import HotelCard from '../components/HotelCard'
import StickySectionHeading from '../components/StickySectionHeading'
import JumpNav, { JUMP_NAV_SCROLL_MT, type JumpTarget } from '../components/JumpNav'
import { ANCHOR_SCROLL_MT } from '../lib/anchorOffset'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { GOLKONDA_STAY_HASH } from '../lib/golkondaStay'

// Every hotel on the page is a hotel, so the word earns nothing in a chip and
// costs width on a phone.
const jumpTargets: JumpTarget[] = [
  { id: 'pre-wedding-hotels', label: 'Pre-Wedding' },
  { id: 'wedding-hotels', label: 'Wedding' },
]

// Replaces the Golkonda card's stock description for a guest who has a room.
// Its last sentence otherwise punts to the RSVP — stale for them, and the note
// below now answers it outright.
const GOLKONDA_ROOM_DESCRIPTION =
  "We're lucky to be hosting our wedding at Golkonda Resort, where many of our guests will be " +
  'staying and celebrating together throughout the weekend.'

// The two nights held at the resort are Oct 27 and 28, so a guest with a room
// still needs the pre-wedding list for Oct 26 — nothing is hidden from them.
const OFFER = 'We’ve arranged a room for you here for the nights of October 27 and 28'
const OPT_OUT = ' If you’d rather make your own arrangements, just let us know.'

const roomNote = {
  // Deliberately silent on money: a covered guest has nothing to settle, and
  // raising the subject only invites the question.
  covered: `${OFFER}.${OPT_OUT}`,
  own:
    `${OFFER}. The two nights come to roughly $350 per room, for one to three people, and you ` +
    `can settle it with the resort directly at check-in or checkout — nothing to pay in ` +
    `advance.${OPT_OUT}`,
} as const

// The dialog's defaults are the Schedule page's; this page is about rooms.
const UNLOCK_COPY = {
  heading: 'Unlock your stay',
  blurb: 'Add your name and we’ll show you the hotels we’ve arranged for you.',
  submitLabel: 'Unlock Your Stay',
}

const Hotels: React.FC = () => {
  // Set only for guests the generator resolved to a room at the resort: tagged,
  // attending, and taking it. Undefined on the server and on the first client
  // render, so the prerendered page and the hydrated one agree.
  const { events, golkonda, golkondaRoom, displayName, status, openUnlock } =
    useGuestScheduleContext()

  // The popup is reachable from a link we send guests — /hotels#golkonda-stay —
  // as well as the card's button. The hash is read after mount and on
  // hashchange, like Bookshelf's pullouts, and then waits on the guest's
  // record the way WhatToWear's event anchors do: the room only exists once
  // the record is decrypted, which is never at first paint.
  const [stayOpen, setStayOpen] = useState(false)
  const [stayHash, setStayHash] = useState(false)
  useEffect(() => {
    const read = () => setStayHash(window.location.hash === `#${GOLKONDA_STAY_HASH}`)
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  // Derived rather than set from an effect. A guest with no room keeps the
  // plain page: the link was not meant for them, and an empty popup would only
  // say so.
  const stayVisible =
    stayOpen || (stayHash && status === 'identified' && golkondaRoom !== undefined)
  useEffect(() => {
    // Not 'notFound' too: that only happens inside the unlock dialog, which is
    // already open, and reopening it would reset what they typed.
    if (stayHash && status === 'anonymous') openUnlock(UNLOCK_COPY)
  }, [stayHash, status, openUnlock])

  const closeStay = useCallback(() => {
    setStayOpen(false)
    // Off the URL once dismissed, or a reload would open it again. replaceState
    // rather than navigate, so the router does not scroll the page back up.
    if (window.location.hash === `#${GOLKONDA_STAY_HASH}`) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      )
      setStayHash(false)
    }
  }, [])

  // Two coarser gates, read off the events the same way /travel and
  // /kerala-itinerary read the Kerala trip. Not everyone is invited to the
  // Pellikuthuru, and not everyone can stay at the resort, so the pre-wedding
  // list and the Golkonda card are shown only to a guest who has unlocked the
  // site and carries the matching event. Both are false until the record is
  // decrypted, so anonymous, prerendered and first-client renders all agree —
  // an invited guest who never signs in loses them, which is accepted: those
  // guests have already had their stays spelled out by email.
  const invitedToPellikuthuru = events.some((event) => event.id === PELLIKUTHURU_EVENT_ID)
  const taggedForGolkonda = events.some((event) => event.id === GOLKONDA_STAY_EVENT_ID)

  const preWedding = hotels.filter((h) => h.section === 'pre-wedding')
  const wedding = hotels.filter(
    (h) => h.section === 'wedding' && (taggedForGolkonda || h.slug !== GOLKONDA_SLUG),
  )

  // Without the pre-wedding section there is one section left and nothing to
  // jump between, so the bar goes too. The heading then pins under SiteNav
  // alone (the JumpNavOffset default) and the section's scroll margin has to
  // match, or a deep link to #wedding-hotels lands the bar's height short.
  const content = (
    <>
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Where to Stay</h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              We're lucky to be hosting our wedding at Golkonda Resort, where many of our guests
              will be staying and celebrating together throughout the week.{' '}
              {golkonda
                ? 'We’ve arranged a room for you at the resort — the details are with the hotel below.'
                : 'Accommodation at the resort has been arranged for a number of our guests and will be reflected in your RSVP details.'}
            </p>
            {/* Its own paragraph rather than a clause in the one above: the
                block covers the pre-wedding nights, so it is for every guest
                invited to the Pellikuthuru, including the ones who already
                have a room at the resort. It goes with the section it points
                at — "just below" would otherwise point at nothing. */}
            {invitedToPellikuthuru && (
              <p className="mt-6 font-body text-lg leading-relaxed text-zeus/80">
                We’ve also held a block of rooms at the Taj Krishna for the nights of October 25 and
                26 — booking details are just below.
              </p>
            )}
            <p className="mt-6 font-body text-lg leading-relaxed text-zeus/80">
              For those making their own arrangements, there are plenty of wonderful nearby hotels
              and rentals — we've shared a few of our favorites below to help make your stay easy
              and comfortable!
            </p>
          </div>
          {/* Both hotel gates above stay shut for a guest who hasn't unlocked,
              and nothing on the page says so — an invited guest would just see
              a shorter list and assume it was the whole of it. Hidden once
              identified, and on 'error', where there's no index to unlock
              against. Disabled rather than hidden while loading, so a returning
              guest's page doesn't jump when the button disappears. */}
          {status !== 'identified' && status !== 'error' && (
            <div className="mx-auto mt-6 max-w-xl">
              <p className="text-left font-body text-lg leading-relaxed text-zeus/80">
                Add your name to see the hotels we’ve arranged for you.
              </p>
              <button
                type="button"
                onClick={() => openUnlock(UNLOCK_COPY)}
                disabled={status === 'loading'}
                className="btn-primary mt-6"
              >
                Unlock Your Stay
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-12 py-12 font-body">
        {invitedToPellikuthuru && (
          <section id="pre-wedding-hotels" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Banjara Hills · October 26"
              title="Pre-Wedding Hotels"
              anchorId="pre-wedding-hotels"
            />
            <ul className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 px-4">
              {preWedding.map((hotel) => (
                <HotelCard key={hotel.slug} hotel={hotel} />
              ))}
            </ul>
          </section>
        )}

        <section
          id="wedding-hotels"
          className={invitedToPellikuthuru ? JUMP_NAV_SCROLL_MT : ANCHOR_SCROLL_MT}
        >
          <StickySectionHeading
            eyebrow="Gandipet · October 27–28"
            title="Wedding Hotels"
            anchorId="wedding-hotels"
          />
          <ul className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 px-4">
            {wedding.map((hotel) => {
              const yours = golkonda !== undefined && hotel.slug === GOLKONDA_SLUG
              return (
                <HotelCard
                  key={hotel.slug}
                  hotel={hotel}
                  reservedForYou={yours}
                  description={yours ? GOLKONDA_ROOM_DESCRIPTION : undefined}
                  note={golkonda && yours ? roomNote[golkonda] : undefined}
                  action={
                    yours && golkondaRoom ? (
                      <button
                        type="button"
                        onClick={() => setStayOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-rosewood px-4 py-1.5 font-medium text-cream shadow-sm transition-colors hover:bg-rosewood/90"
                      >
                        See your room
                      </button>
                    ) : undefined
                  }
                />
              )
            })}
          </ul>
        </section>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-peach/20">
      {/* Wraps the header too, so the bar sits at the very top of the page —
          pinned from the start, the way the Travel section's nav is. */}
      {invitedToPellikuthuru ? <JumpNav targets={jumpTargets}>{content}</JumpNav> : content}
      {golkondaRoom && (
        <GolkondaStayModal
          open={stayVisible}
          onClose={closeStay}
          room={golkondaRoom}
          displayName={displayName}
        />
      )}
    </div>
  )
}

export default Hotels
