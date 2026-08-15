import React from 'react'
import { Link } from 'react-router-dom'
import { Bullets, Disclosure, DisclosureGroup } from '../components/Disclosure'
import WhatToWearButton from '../components/WhatToWearButton'
import WhereToShop from '../components/WhereToShop'
import { useHashDisclosure } from '../lib/useHashDisclosure'
import RsvpModal from '../components/RsvpModal'
import { WITHJOY_RSVP_URL } from '../lib/constants'

const linkClass = 'underline hover:text-rosewood'

// Opens the password modal the nav and landing page already use. Rendered as a
// child so the answer copy stays declarative up in `groups`.
const RsvpLink: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <button type="button" onClick={onOpen} className={`${linkClass} cursor-pointer`}>
    RSVP on Joy
  </button>
)

// `id`s are the deep-link anchors (/faq#kids-welcome) and are hand-written
// rather than derived from the questions, so rewording one doesn't quietly
// break links people have already shared.
//
// Anything that /travel/tips or /evisa already answers in depth gets a short
// answer and a link, never a second copy of the facts — a previous FAQ page was
// removed from this site for drifting out of step with the travel copy.
const groups = (
  openRsvp: () => void,
): {
  id: string
  title: string
  blurb: string
  questions: { id: string; title: string; body: React.ReactNode }[]
}[] => [
  {
    id: 'rsvp-and-guests',
    title: 'RSVP & Guests',
    blurb: 'Who’s coming, and how to let us know.',
    questions: [
      {
        id: 'rsvp-deadline',
        title: 'When is the RSVP deadline?',
        body: (
          <p>
            Please RSVP by July 1, so we can have an accurate headcount. You can{' '}
            <RsvpLink onOpen={openRsvp} /> — you’ll need the password to get in.
          </p>
        ),
      },
      {
        id: 'bring-a-date',
        title: 'Can I bring a date?',
        body: <p>Please check your invite for your +1!</p>,
      },
      {
        id: 'kids-welcome',
        title: 'Are kids welcome?',
        body: (
          <p>
            Of course! Children are warmly welcome. Just make sure any little ones are included in
            your RSVP — either they’re already listed in your invitation, or reach out to us and
            we’ll get them added.
          </p>
        ),
      },
    ],
  },
  {
    id: 'at-the-celebrations',
    title: 'At the Celebrations',
    blurb: 'What to expect once you’re on the property.',
    questions: [
      {
        id: 'weather',
        title: 'What will the weather be like?',
        body: (
          <p>
            Late October in Hyderabad will be pleasant and warm — think 75–85°F (24–29°C). It’s
            post-monsoon, so there’s always the chance of a shower.
          </p>
        ),
      },
      {
        id: 'parking',
        title: 'Where should I park?',
        body: <p>There is plenty of event parking, and the staff will be able to guide you.</p>,
      },
      {
        id: 'accessibility',
        title: 'Are the ceremony and reception locations wheelchair accessible?',
        body: (
          <p>
            Yes, and we’ll have a golf cart available for anyone needing assistance getting around
            the property.
          </p>
        ),
      },
      {
        id: 'indoors-or-outdoors',
        title: 'Is the wedding indoors or outdoors?',
        body: <p>We aim to have as much of the celebration outdoors on the lawns as possible.</p>,
      },
      {
        id: 'food',
        title: 'What food will be served at the wedding?',
        body: (
          <>
            <p>
              All food served across the wedding events will be strictly vegetarian. Golkonda Resort
              is accustomed to hosting international guests, so you can expect a beautiful variety
              of cuisines throughout the events, though traditional Indian dishes will naturally
              take center stage.
            </p>
            <p>
              A highlight of the weekend is our Traditional South Indian Lunch, where you’ll get to
              experience a classic vegetarian feast served on banana leaves, the way it’s meant to
              be eaten. South Indian food is known for its bold, complex flavors, and yes, some
              dishes can bring the heat! Don’t worry though — we’ll make sure there’s something for
              everyone, whether you’re a spice lover or prefer to keep things mild.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'what-to-wear',
    title: 'What to Wear',
    blurb: 'Dressing for the week, and where to find the clothes.',
    questions: [
      {
        // Was two questions — this one and "I want to wear Indian clothing —
        // where do I start?" — each answering a slice of the same thing, one
        // with the dress codes and one with a paragraph of garment names. Both
        // now live on /what-to-wear in full, so the answer here is the way there.
        id: 'dress-code',
        title: 'What should I wear?',
        body: (
          <>
            <p>
              It varies by event — a relaxed morning and a wedding-formal reception ask for
              different things. Our What to Wear guide has the dress code for each of your events,
              and if you’d like to wear Indian clothing, a photo of every outfit with the events it
              suits.
            </p>
            <p>
              <WhatToWearButton />
            </p>
            <p>
              Our{' '}
              <Link to="/travel/tips#outfits" className={linkClass}>
                Travel Tips
              </Link>{' '}
              cover what to pack for the rest of the week.
            </p>
          </>
        ),
      },
      {
        id: 'where-to-shop',
        title: 'Where can I shop for Indian clothing?',
        body: <WhereToShop />,
      },
      {
        id: 'shoes',
        title: 'What kind of shoes should I wear?',
        body: (
          <p>
            Calling all ladies! Do not wear stiletto heels. I repeat, do not wear stiletto heels.
            There are a bunch of grassy areas you might have to walk across, so wear chunky heels or
            sandals.
          </p>
        ),
      },
    ],
  },
  {
    id: 'traveling-to-india',
    title: 'Traveling to India',
    blurb: 'The short answers — our Travel Tips page has the detail.',
    questions: [
      {
        id: 'visa',
        title: 'Do I need a visa to attend the wedding?',
        body: (
          <p>
            Most likely — depending on your nationality, you’ll need an e-Tourist Visa, applied for
            online before you fly. The application is a bit cumbersome, so we built an{' '}
            <Link to="/evisa" className={linkClass}>
              e-Visa Helper
            </Link>{' '}
            that walks you through the form step by step and resizes your photo and passport scan to
            meet the upload limits. Our{' '}
            <Link to="/travel/tips#visa-entry-documents" className={linkClass}>
              travel tips on visas and entry documents
            </Link>{' '}
            cover the timing.
          </p>
        ),
      },
      {
        id: 'e-arrival-card',
        title: 'What is the e-Arrival Card and do I need one?',
        body: (
          <p>
            Yes — it’s a short online form capturing your travel and contact details, and India asks
            every international traveler to complete it before landing. Keep it with your visa
            approval; there’s more in our{' '}
            <Link to="/travel/tips#visa-entry-documents" className={linkClass}>
              visa and entry documents
            </Link>{' '}
            tip.
          </p>
        ),
      },
      {
        id: 'passport-validity',
        title: 'Does my passport need to be valid for a certain amount of time?',
        body: (
          <p>
            Yes — at least six months beyond your travel dates, with a couple of blank pages.
            Renewals can take weeks, so{' '}
            <Link to="/travel/tips#check-your-passport" className={linkClass}>
              check your passport
            </Link>{' '}
            now rather than the week before.
          </p>
        ),
      },
      {
        id: 'health',
        title: 'Are there any health tips for traveling to India?',
        body: (
          <>
            <p>
              We want all of our guests to feel their best. Nothing is required for U.S. travelers,
              but it’s worth talking vaccinations through with a travel clinic — some need a few
              weeks or come in a series, so book early. Our{' '}
              <Link to="/travel/tips#see-a-travel-nurse" className={linkClass}>
                travel nurse tip
              </Link>{' '}
              has the details and the official guidance to read first.
            </p>
            <p>
              One thing that page doesn’t cover: Hyderabad’s air quality can vary in the cooler
              months, so pack any relevant medication if you have respiratory sensitivities.
            </p>
          </>
        ),
      },
      {
        id: 'staying-connected',
        title: 'How should I stay connected while in India?',
        body: (
          <p>
            WhatsApp is the best mode of communication in India — download it before you arrive,
            since it’s how we’ll be coordinating with guests on the ground as well. For data, see
            our{' '}
            <Link to="/travel/tips#staying-connected-esim" className={linkClass}>
              eSIM tip
            </Link>
            .
          </p>
        ),
      },
      {
        id: 'before-you-leave',
        title: 'Is there anything I should take care of at home before I leave?',
        body: (
          <>
            <p>A few loose ends worth handling before you fly:</p>
            <Bullets
              items={[
                <>
                  Book your room and any onward travel — our{' '}
                  <Link to="/hotels" className={linkClass}>
                    Hotels
                  </Link>{' '}
                  page has the places we’d recommend and how close each one is to the celebrations.
                </>,
                <>
                  If you’re a U.S. voter, make a voting plan. Election Day is Tuesday, November 3,
                  right after the celebrations — our{' '}
                  <Link to="/travel/tips#make-a-voting-plan" className={linkClass}>
                    voting plan tip
                  </Link>{' '}
                  suggests voting early and links you to your own state’s rules.
                </>,
                <>
                  Let your bank and card issuers know your travel dates so nothing gets frozen
                  mid-trip — there’s more in{' '}
                  <Link to="/travel/tips#cards-and-your-bank" className={linkClass}>
                    cards &amp; your bank
                  </Link>
                  .
                </>,
              ]}
            />
          </>
        ),
      },
    ],
  },
]

const Faq: React.FC = () => {
  useHashDisclosure()

  const [rsvpOpen, setRsvpOpen] = React.useState(false)
  const rsvpTriggerRef = React.useRef<HTMLElement | null>(null)

  // Return focus to whichever answer's button opened the modal, since the
  // trigger lives inside a disclosure rather than in a fixed spot on the page.
  React.useEffect(() => {
    if (!rsvpOpen) return
    return () => rsvpTriggerRef.current?.focus()
  }, [rsvpOpen])

  const openRsvp = React.useCallback(() => {
    rsvpTriggerRef.current = document.activeElement as HTMLElement | null
    setRsvpOpen(true)
  }, [])

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Questions & Answers</h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              The things guests ask us most, from RSVPs and what to wear to getting yourself to
              India.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 font-body">
        {groups(openRsvp).map((group) => (
          <DisclosureGroup key={group.id} id={group.id} title={group.title} blurb={group.blurb}>
            {group.questions.map((question) => (
              <Disclosure key={question.id} id={question.id} title={question.title}>
                {question.body}
              </Disclosure>
            ))}
          </DisclosureGroup>
        ))}

        <p className="mt-4 text-xs text-zeus/60">
          Still stuck on something? Reach out to us directly — we’d far rather answer than have you
          guess.
        </p>
      </div>

      <RsvpModal open={rsvpOpen} onClose={() => setRsvpOpen(false)} href={WITHJOY_RSVP_URL} />
    </div>
  )
}

export default Faq
