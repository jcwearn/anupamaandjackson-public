/**
 * The server half of the guest lookup: takes the name a guest typed and asks
 * Wedding HQ for their page.
 *
 * Guests used to be looked up entirely in the browser, against
 * public/schedule-index.json — every guest's page, encrypted under their own
 * name, in one file anyone could download. Names are guessable, so that file
 * was the guest list for anyone patient with a list of common names. Now the
 * browser posts the name here, this asks HQ (`POST /api/site/lookup`), and only
 * that one guest's page comes back. HQ sits behind Cloudflare Access, which a
 * guest's browser cannot get through, so the call carries an Access service
 * token held in Pages secrets.
 *
 * The schedule is this repo's data/schedule-events.json, and nowhere else. HQ
 * keeps no copy of it: each lookup carries the gate rules (which With Joy tags
 * unlock which event id, no copy), HQ answers with the guest's event ids, and
 * the copy is attached here, server-side, so an invite-only event's details
 * never ship in the public bundle. HQ used to hold an imported copy of the
 * catalog, and keeping it in step with this file was a step that got forgotten.
 * The catalog is passed in rather than imported: src/ never imports data/.
 *
 * Runs in two places with the same code: the Pages Function at
 * functions/guest/lookup.ts in production, and a Vite middleware under
 * `npm run dev` and `npm run preview` (vite.config.ts), where the token comes
 * from the shell — direnv loads the wedding-hq one. It lives in src/ rather than
 * functions/ so typecheck and the test suite cover it; nothing in the browser
 * bundle imports it.
 */

/** One event of data/schedule-events.json. */
export interface CatalogEvent {
  id: string
  /** A With Joy tag, or a list of them meaning any-of. */
  gate: string | string[]
  [field: string]: unknown
}

// The fields of an event the site renders. The rest of the catalog -- the gate,
// the universal flag -- stays here.
const RENDERED_FIELDS = [
  'id',
  'date',
  'time',
  'title',
  'location',
  'address',
  'mapUrl',
  'description',
  'agenda',
  'attire',
  'indianWear',
  'note',
  'linkTo',
  'linkLabel',
  'sortKey',
] as const

function rendered(event: CatalogEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of RENDERED_FIELDS) {
    if (event[field] !== undefined) out[field] = event[field]
  }
  return out
}

interface FoundRecord {
  eventIds: string[]
  events?: Record<string, unknown>
  [field: string]: unknown
}

export interface LookupEnv {
  WEDDING_HQ_CLIENT_ID?: string
  WEDDING_HQ_CLIENT_SECRET?: string
  /** Overrides the HQ origin, for pointing a local run at `wrangler dev`. */
  WEDDING_HQ_URL?: string
}

const HQ_ORIGIN = 'https://hq.anupamaandjackson.com'

// Long enough for a cold Worker an ocean away, short enough that a guest is
// told something went wrong before they give up on the page.
const TIMEOUT_MS = 10_000

// HQ caps the same fields; failing here saves the round trip.
const LIMITS = { first: 100, last: 100, hint: 200, email: 254 } as const

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // A guest's page is theirs alone: never cached by the browser, by
      // Cloudflare, or by anything in between.
      'Cache-Control': 'no-store',
      ...headers,
    },
  })

function validInput(body: unknown): body is Record<keyof typeof LIMITS, string | undefined> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const record = body as Record<string, unknown>
  if (typeof record.first !== 'string' || typeof record.last !== 'string') return false
  return Object.entries(LIMITS).every(([field, max]) => {
    const value = record[field]
    return value === undefined || (typeof value === 'string' && value.length <= max)
  })
}

export async function handleLookup(
  request: Request,
  env: LookupEnv,
  catalog: CatalogEvent[],
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const body = await request.json().catch(() => null)
  if (!validInput(body)) return json({ error: 'expected a name' }, 400)

  // Unset, there is nothing to ask HQ with: a local run without direnv, or a
  // Pages environment nobody has given the secret. Fail closed, as unavailable.
  if (!env.WEDDING_HQ_CLIENT_ID || !env.WEDDING_HQ_CLIENT_SECRET) {
    return json({ error: 'lookup unavailable' }, 503)
  }

  // Only the fields HQ reads, so nothing else a client sends is passed along.
  const { first, last, hint, email } = body
  const started = Date.now()
  let upstream: Response
  try {
    upstream = await fetchImpl(`${env.WEDDING_HQ_URL ?? HQ_ORIGIN}/api/site/lookup`, {
      method: 'POST',
      headers: {
        'CF-Access-Client-Id': env.WEDDING_HQ_CLIENT_ID,
        'CF-Access-Client-Secret': env.WEDDING_HQ_CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first,
        last,
        hint,
        email,
        events: catalog.map(({ id, gate }) => ({ id, gate })),
      }),
      // Access answers a bad or expired token with a redirect to its login
      // page. Followed, that is a 200 of HTML; held, it is a clear failure.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return json({ error: 'lookup unavailable' }, 503)
  }
  const timing = [`hq;dur=${Date.now() - started}`, upstream.headers.get('Server-Timing')]
    .filter(Boolean)
    .join(', ')

  if (upstream.status === 200) {
    const result = (await upstream.json()) as { status?: string; record?: FoundRecord }
    if (result.status === 'found' && result.record) {
      // Copy from this repo's file, whatever HQ sent. The universal events'
      // copy comes along too, though the browser prefers its bundled one.
      const byId = new Map(catalog.map((event) => [event.id, event]))
      result.record.events = Object.fromEntries(
        result.record.eventIds.flatMap((id) => {
          const event = byId.get(id)
          return event ? [[id, rendered(event)]] : []
        }),
      )
    }
    return json(result, 200, { 'Server-Timing': timing })
  }
  // A name HQ thinks malformed is the guest's to fix; anything else — Access
  // turning the token away, HQ down, two namesakes With Joy cannot tell apart —
  // is ours, and the site says so without blaming the guest.
  return json(
    { error: upstream.status === 400 ? 'expected a name' : 'lookup unavailable' },
    upstream.status === 400 ? 400 : 503,
    { 'Server-Timing': timing },
  )
}
