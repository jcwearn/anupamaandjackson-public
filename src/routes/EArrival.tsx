import React from 'react'
import { Link } from 'react-router-dom'
import CopyField from '../components/evisa/CopyField'
import StickySectionHeading from '../components/StickySectionHeading'
import { VENUE_ADDRESS, VENUE_DISTRICT, VENUE_STATE } from '../lib/weddingVenue'

const PORTAL_URL = 'https://indianvisaonline.gov.in/earrival/'

// Unlike /evisa this is one short errand, not three stages, so there is no
// jump bar: a single section of the fields people actually get stuck on. The
// rest of the form (name, nationality, passport number, email) asks for exactly
// what it says, and walking through it would only bury these.
//
// Labels are quoted the way the portal words them, so a guest can find the
// field on their screen by matching the card's heading.
const fields: {
  id: string
  title: string
  body: React.ReactNode
  copy?: { label: string; value: string; hint?: string }[]
}[] = [
  {
    id: 'purpose',
    title: 'Purpose',
    body: 'You’re visiting on an e-Tourist Visa, so choose:',
    copy: [{ label: 'Purpose', value: 'TOURIST', hint: 'Pick from the dropdown.' }],
  },
  {
    id: 'address-in-india',
    title: 'Address in India, State and District',
    // State before District because the District dropdown is empty until a
    // State is picked — the form doesn't say so, it just looks broken.
    body: 'Use the wedding venue. Pick the State first; the District list fills in once you do. If you’d rather give the hotel you’re staying in, that works too.',
    copy: [
      { label: 'Address in India', value: VENUE_ADDRESS },
      { label: 'State', value: VENUE_STATE, hint: 'Pick from the dropdown.' },
      { label: 'District', value: VENUE_DISTRICT, hint: 'Pick from the dropdown.' },
    ],
  },
  {
    id: 'isd-code',
    title: 'ISD Code',
    // The box sits beside the number and reads as though it wants "+1"; it
    // wants the country code alone.
    body: (
      <>
        The ISD code is just your country code, digits only — <strong>1</strong> for the U.S., not
        +1. Put the rest of your phone number in the box beside it.
      </>
    ),
  },
  {
    id: 'emergency-contact',
    title: 'Emergency Contact Number',
    body: 'Whoever you’d normally list as your emergency contact. They don’t need to be in India, and the ISD code works the same way as yours.',
  },
]

const EArrival: React.FC = () => {
  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">
            India e-Arrival Card Helper
          </h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              India asks every international traveler to fill out a short e-Arrival Card before
              landing. It’s separate from your{' '}
              <Link to="/evisa" className="underline hover:text-rosewood">
                e-Visa
              </Link>{' '}
              — the portal itself says it’s “for arrival information, not a visa” — and takes a few
              minutes. Most of it is self-explanatory; here are the fields that aren’t.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-12 py-12 font-body">
        <div className="mx-auto w-full max-w-2xl px-4">
          {/* The one thing to read before anything else: unlike the e-Visa,
              this can't be done weeks ahead. The date picker only offers
              arrival dates a few days out — on October 13 it allowed the 12th
              through the 16th — so the page says "a few days" rather than an
              hour count the portal never states. */}
          <div
            id="when-to-fill-it-in"
            className="rounded-lg border border-gold/40 bg-lily/25 px-4 py-3 text-sm leading-relaxed text-zeus/80"
          >
            <p>
              <strong>Fill it out in the few days before you fly.</strong> The form only lets you
              pick an arrival date a few days ahead, so you can’t do it weeks in advance the way you
              can the e-Visa. Each traveler needs their own card; “Add Member” on the form lets you
              do your group in one go.
            </p>
          </div>
        </div>

        <section id="the-tricky-fields">
          <StickySectionHeading
            eyebrow="On the portal"
            title="Fields that need a little help"
            anchorId="the-tricky-fields"
          />
          <div className="mx-auto mt-6 w-full max-w-2xl px-4">
            <ul className="flex flex-col gap-4">
              {fields.map((item) => (
                <li key={item.id} id={item.id} className="card">
                  <h3 className="font-display text-lg text-rosewood">{item.title}</h3>
                  <p className="mt-1 text-sm text-zeus/80">{item.body}</p>
                  {item.copy && (
                    <div className="mt-3 space-y-2">
                      {item.copy.map((field) => (
                        <CopyField key={field.label} {...field} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="btn-primary">
                Fill it out on the official portal →
              </a>
            </div>
            <p className="mt-4 text-sm text-zeus/70">
              When you submit, save or print the confirmation and keep it with your passport and
              e-Visa approval.
            </p>
          </div>
        </section>

        <p className="mx-auto w-full max-w-2xl px-4 text-xs text-zeus/60">
          This page is a friendly helper made for our wedding guests and isn’t affiliated with the
          Government of India. Please rely on the official portal for the authoritative process.
        </p>
      </div>
    </div>
  )
}

export default EArrival
