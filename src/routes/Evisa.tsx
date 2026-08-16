import React from 'react'
import clsx from 'clsx'
import FileShrinker from '../components/evisa/FileShrinker'
import CopyField from '../components/evisa/CopyField'
import StickySectionHeading from '../components/StickySectionHeading'
import JumpNav, {
  JUMP_NAV_INNER_SCROLL_MT,
  JUMP_NAV_SCROLL_MT,
  type JumpTarget,
} from '../components/JumpNav'

const PORTAL_URL = 'https://indianvisaonline.gov.in/evisa/Registration'
const PORTAL_HOME = 'https://indianvisaonline.gov.in/evisa'
const SAMPLE_FORM_URL = 'https://indianvisaonline.gov.in/evisa/images/SampleForm.pdf'

// The page is one long errand, so the chips name the three stages of it. Labels
// are short because all three have to sit on one row at 390px — the same
// constraint TRAVEL_NAV_ITEMS documents.
const jumpTargets: JumpTarget[] = [
  { id: 'what-youll-need', label: 'What you’ll need' },
  { id: 'your-photos', label: 'Your photos' },
  { id: 'the-application', label: 'The application' },
]

const checklist = [
  {
    id: 'passport',
    title: 'Your passport',
    body: 'Keep it beside you — you’ll need details from it throughout the application.',
  },
  {
    id: 'family',
    title: 'Family information',
    body: 'Date of birth and place of birth for your father, your mother, and your spouse (if applicable).',
  },
  {
    id: 'travel',
    title: 'Travel information',
    body: 'Your approximate arrival date in India (note: this is different from your day of departure).',
  },
  {
    id: 'paypal',
    title: 'A PayPal account',
    body: 'The visa fee is paid through PayPal, so set up an account before you start if you don’t already have one.',
  },
  {
    id: 'reference',
    title: 'Your reference in India',
    body: 'The application requires the name, address, and phone number of a reference in India. If you don’t have one, use our wedding contact — each line below matches a field on the form:',
  },
]

// `display` overrides how the value is rendered without changing what gets
// copied — only the phone number needs it.
const referenceContact: {
  label: string
  value: string
  hint?: string
  display?: React.ReactNode
}[] = [
  { label: 'Reference Name in India', value: 'The Golkonda Resorts and Spas' },
  {
    label: 'Address',
    value: 'Sagar Mahal Complex, near Osman Sagar Lake, Gandipet, Hyderabad 500075',
  },
  { label: 'State', value: 'TELANGANA', hint: 'Pick from the dropdown.' },
  { label: 'District', value: 'RANGAREDDI', hint: 'Pick from the dropdown.' },
  {
    label: 'Phone No/Mobile No',
    value: '9104035010101',
    // Only the digits live in the DOM; the +, parentheses, space, and dash are
    // CSS pseudo-elements, so a copy picks up just the digits — whether it comes
    // from the button or from select-all.
    display: (
      <>
        <span className="before:content-['+']">91</span>
        <span className="before:content-['_('] after:content-[')']">040</span>
        <span className="before:content-['_']">3501</span>
        <span className="before:content-['-']">0101</span>
      </>
    ),
  },
]

const steps: {
  title: string
  body: React.ReactNode
  bullets?: React.ReactNode[]
  field?: { label: string; value: string; hint?: string }
}[] = [
  {
    title: 'Get started',
    // "Apply here for e-visa" keeps the portal's own lowercase spelling: it is a
    // quotation of the button, and misquoting it makes the button harder to find.
    body: (
      <>
        Open the{' '}
        <a
          href={PORTAL_HOME}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-rosewood"
        >
          official portal
        </a>
        , scroll to the bottom of the e-Visa homepage, and click “Apply here for e-visa.”
      </>
    ),
  },
  {
    title: 'Choose your visa',
    body: 'On the second screen, in the “Visiting India for” field, select:',
    field: {
      label: 'Visiting India for',
      // Verbatim, punctuation and all — the guest has to match this option exactly.
      value: 'xlv. e-Tourist Visa 30 days (e-T1 V) - TOURISM,RECREATION,SIGHT-SEEING',
      hint: 'Pick from the dropdown.',
    },
  },
  {
    title: 'Fill in your details',
    body: 'The portal is dated and not always forthcoming about what it wants. A few things to keep in mind as you go:',
    bullets: [
      'Enter everything exactly as it appears on your passport.',
      'When a question doesn’t apply to you, or you’re unsure whether it does, “NA” is a safe answer.',
      'Phone numbers are digits only with the U.S. country code 1 first — no spaces, dashes, or parentheses (for example: 14045551234).',
      <>
        Use the{' '}
        <a href="#reference" className="underline hover:text-rosewood">
          wedding contact
        </a>{' '}
        above as your reference in India.
      </>,
      // False positive, and worth not "fixing". These entries are a
      // ReactNode[], not elements React iterates: the render site maps each one
      // into `<li key={j}>{bullet}</li>`, so the key lives on the <li> and this
      // <strong> is its child. React never warns at runtime. oxlint flags any
      // JSX inside an array literal because it cannot see the map that consumes
      // it. Adding a key here would be dead code.
      // oxlint-disable-next-line react/jsx-key
      <strong>
        Double-check each screen before pressing Save and Continue: there’s no back button, and
        while most fields can be corrected at the final review, some (like your date of birth) can’t
        be changed later.
      </strong>,
      <>
        <strong>
          If a screen just resets when you press Save and Continue, with no error shown, a field on
          it failed validation.
        </strong>{' '}
        The portal usually won’t tell you which one. When you’re stuck, fall back to plain letters
        and spaces: most fields reject special characters the way the phone number does, and some
        reject numbers too.
      </>,
    ],
  },
  {
    title: 'Upload your files',
    body: 'Upload the headshot (JPEG) and passport page (PDF) you prepared above.',
  },
  {
    title: 'Pay and submit',
    body: 'Pay the visa fee with your PayPal account and submit. You’ll get a confirmation by email with your application ID.',
  },
  {
    title: 'Receive your approval (ETA)',
    // "Application Status :-Granted" is verbatim, odd spacing and all, for the
    // same reason the dropdown option above is: the guest is matching it against
    // what's on their screen.
    body: (
      <>
        Your Electronic Travel Authorization arrives by email, usually within a few business days.
        It’s a plain text email — there’s no attachment and no PDF — so the line to look for is{' '}
        <strong>Application Status :-Granted</strong>.
      </>
    ),
  },
  {
    title: 'Print your e-Visa',
    body: 'Print the approval email itself — there’s nothing separate to download — and pack it with your passport. You’ll need to show it when you check in for your flight to India, and again on arrival.',
  },
]

const Evisa: React.FC = () => {
  return (
    <div className="min-h-screen bg-peach/20">
      {/* Wraps the header too, so the bar sits at the very top of the page —
          pinned from the start, the way Hotels and the Travel section are. */}
      <JumpNav targets={jumpTargets}>
        <header className="bg-peach/60 px-4 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-4xl text-rosewood sm:text-5xl">India e-Visa Helper</h1>
            <div className="mx-auto mt-4 max-w-xl text-left">
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                We can’t wait to celebrate with you in India! Almost all visitors need an e-Visa to
                travel, so apply a few weeks before you fly to leave room for processing. Here’s
                everything to gather first, then a walkthrough of the application.
              </p>
            </div>
          </div>
        </header>

        {/* max-w and px live on each section's own content, not out here:
            StickySectionHeading brings its own, and it has to span the full
            width to pin against. Same shape as Hotels. */}
        <div className="flex flex-col gap-12 py-12 font-body">
          <section id="what-youll-need" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Step 1 · Before you start"
              title="What you’ll need"
              anchorId="what-youll-need"
            />
            <div className="mx-auto mt-6 w-full max-w-2xl px-4">
              <p className="text-zeus/80">
                Having everything ready before you open the application makes the process much
                easier.
              </p>
              <ul className="mt-4 flex flex-col gap-4">
                {checklist.map((item) => (
                  // The ids are anchor targets: step 3 of the walkthrough links
                  // back up to the reference card.
                  <li key={item.id} id={item.id} className={clsx('card', JUMP_NAV_INNER_SCROLL_MT)}>
                    <h3 className="font-display text-lg text-rosewood">{item.title}</h3>
                    <p className="mt-1 text-sm text-zeus/80">{item.body}</p>
                    {item.id === 'reference' && (
                      <div className="mt-3 space-y-2">
                        {referenceContact.map(({ display, ...field }) => (
                          <CopyField key={field.label} {...field}>
                            {display}
                          </CopyField>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="your-photos" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Step 2 · Prepare your files"
              title="Your photos"
              anchorId="your-photos"
            />
            <div className="mx-auto mt-6 w-full max-w-2xl px-4">
              <p className="text-zeus/80">
                You’ll upload two things: a clear photo of your passport’s signature and information
                page, and a recent front-facing headshot. Don’t worry about file size or format —
                the converters below handle that.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FileShrinker mode="headshot" />
                <FileShrinker mode="passport" />
              </div>
              <p className="mt-3 text-xs text-zeus/70">
                Everything happens right in your browser, so your photo and passport never leave
                your device. Start from a good, well-lit photo — the e-Visa asks for a square
                headshot with a plain light background and a clearly legible passport page.
              </p>
            </div>
          </section>

          <section id="the-application" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Step 3 · On the portal"
              title="The application"
              anchorId="the-application"
            />
            <div className="mx-auto mt-6 w-full max-w-2xl px-4">
              {/* A rail rather than seven cards: this is one sequence you work
                  through in order, not seven things to choose between. */}
              <ol>
                {steps.map((s, i) => {
                  const last = i === steps.length - 1
                  return (
                    <li key={s.title} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-cream font-medium text-rosewood">
                          {i + 1}
                        </span>
                        {/* flex-1 in a column takes whatever height the content
                            column set, so the rail measures itself and the last
                            step simply has none. */}
                        {!last && (
                          <span aria-hidden data-step-rail className="w-px flex-1 bg-gold/40" />
                        )}
                      </div>
                      <div className={clsx('min-w-0 flex-1', !last && 'pb-8')}>
                        <h3 className="font-display text-lg text-rosewood">{s.title}</h3>
                        <p className="mt-1 text-sm text-zeus/80">{s.body}</p>
                        {s.field && (
                          <div className="mt-3">
                            <CopyField {...s.field} />
                          </div>
                        )}
                        {s.bullets && (
                          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-zeus/80">
                            {s.bullets.map((bullet, j) => (
                              <li key={j}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="btn-primary">
                  Apply on the official portal →
                </a>
                <a
                  href={SAMPLE_FORM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-full border border-gold/60 px-6 py-2 font-medium text-zeus transition-colors hover:bg-peach/60"
                >
                  See the official walkthrough (PDF)
                </a>
              </div>
              <p className="mt-4 text-sm text-zeus/70">
                Always confirm the current fees, timing, and document rules on the{' '}
                <a
                  href={PORTAL_HOME}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-rosewood"
                >
                  official site
                </a>{' '}
                — it’s the source of truth.
              </p>
            </div>
          </section>

          <p className="mx-auto w-full max-w-2xl px-4 text-xs text-zeus/60">
            This page is a friendly helper made for our wedding guests and isn’t affiliated with the
            Government of India. Please rely on the official portal for the authoritative process.
          </p>
        </div>
      </JumpNav>
    </div>
  )
}

export default Evisa
