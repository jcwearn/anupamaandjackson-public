import { describe, it, expect, vi } from 'vitest'
import { handleLookup } from './guestLookupProxy'

const ENV = { WEDDING_HQ_CLIENT_ID: 'id.access', WEDDING_HQ_CLIENT_SECRET: 'secret' }

const CATALOG = [
  { id: 'ceremony', gate: 'muhurtam', universal: true, title: 'Ceremony', time: '9:00 AM' },
  {
    id: 'welcome',
    gate: ['sangeet', 'family'],
    title: 'Welcome',
    time: '6:00 PM',
    agenda: ['Dinner'],
  },
  { id: 'kerala', gate: 'optional-trip', title: 'Kerala', time: 'Oct 29' },
]

const post = (body: unknown) =>
  new Request('https://anupamaandjackson.com/guest/lookup', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const hq = (response: Response | Promise<Response>) => vi.fn(async () => response)

describe('handleLookup', () => {
  it('asks HQ with the service token and passes the answer on, uncached', async () => {
    const fetchImpl = hq(
      Response.json(
        { status: 'not_found' },
        { headers: { 'Server-Timing': 'd1;dur=12, total;dur=15' } },
      ),
    )

    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      fetchImpl,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'not_found' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Server-Timing')).toMatch(/^hq;dur=\d+, d1;dur=12, total;dur=15$/)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hq.anupamaandjackson.com/api/site/lookup')
    expect(init.headers).toMatchObject({
      'CF-Access-Client-Id': 'id.access',
      'CF-Access-Client-Secret': 'secret',
    })
    // Access's answer to a bad token is a redirect to its login page; followed,
    // that would come back as a 200 of HTML.
    expect(init.redirect).toBe('manual')
  })

  it('forwards only the fields HQ reads', async () => {
    const fetchImpl = hq(Response.json({ status: 'not_found' }))

    await handleLookup(
      post({ first: 'Ada', last: 'Lovelace', email: 'ada@example.com', extra: 'x' }),
      ENV,
      CATALOG,
      fetchImpl,
    )

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      first: 'Ada',
      last: 'Lovelace',
      email: 'ada@example.com',
      // The gates, and nothing of the copy: HQ needs only which tags unlock
      // which event.
      events: [
        { id: 'ceremony', gate: 'muhurtam' },
        { id: 'welcome', gate: ['sangeet', 'family'] },
        { id: 'kerala', gate: 'optional-trip' },
      ],
    })
  })

  it.each([
    ['not JSON', 'nope'],
    ['no name', {}],
    ['a name that is not text', { first: 1, last: 'Lovelace' }],
    ['an oversized name', { first: 'x'.repeat(101), last: 'Lovelace' }],
  ])('refuses %s without asking HQ', async (_, body) => {
    const fetchImpl = hq(Response.json({}))

    const res = await handleLookup(post(body), ENV, CATALOG, fetchImpl)

    expect(res.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed where no token is configured', async () => {
    const fetchImpl = hq(Response.json({}))

    const res = await handleLookup(post({ first: 'Ada', last: 'Lovelace' }), {}, CATALOG, fetchImpl)

    expect(res.status).toBe(503)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['Access turning the token away', new Response(null, { status: 302 })],
    ['HQ refusing it', new Response('{}', { status: 403 })],
    ['namesakes HQ cannot tell apart', new Response('{}', { status: 409 })],
    ['HQ failing', new Response('{}', { status: 500 })],
  ])('says the lookup is unavailable on %s', async (_, response) => {
    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      hq(response),
    )

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'lookup unavailable' })
  })

  it('says the lookup is unavailable when HQ cannot be reached at all', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network')
    })

    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      fetchImpl,
    )

    expect(res.status).toBe(503)
  })

  it("fills a found guest's events from this repo's catalog, whatever HQ sent", async () => {
    const fetchImpl = hq(
      Response.json({
        status: 'found',
        record: {
          displayName: 'Ada',
          eventIds: ['ceremony', 'welcome', 'retired'],
          // A stale copy from HQ's old catalog: ignored.
          events: { welcome: { id: 'welcome', title: 'Old welcome' } },
        },
      }),
    )

    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      fetchImpl,
    )

    expect(await res.json()).toEqual({
      status: 'found',
      record: {
        displayName: 'Ada',
        eventIds: ['ceremony', 'welcome', 'retired'],
        // Rendered fields only -- no gate, no universal flag -- and an id the
        // catalog no longer has is simply left out.
        events: {
          ceremony: { id: 'ceremony', title: 'Ceremony', time: '9:00 AM' },
          welcome: { id: 'welcome', title: 'Welcome', time: '6:00 PM', agenda: ['Dinner'] },
        },
      },
    })
  })

  it("passes a found guest's Golkonda room on as HQ sent it", async () => {
    const golkondaRoom = {
      bed: 'king',
      roommates: ['Grace Hopper'],
      checkIn: '2026-10-27',
      checkOut: '2026-10-29',
    }
    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      hq(
        Response.json({
          status: 'found',
          record: { displayName: 'Ada', golkonda: 'covered', golkondaRoom, eventIds: [] },
        }),
      ),
    )
    expect(((await res.json()) as any).record).toMatchObject({ golkonda: 'covered', golkondaRoom })
  })

  it('passes other answers on untouched', async () => {
    const choose = { status: 'choose', options: [], canVerifyEmail: false }
    const res = await handleLookup(
      post({ first: 'Ada', last: 'Lovelace' }),
      ENV,
      CATALOG,
      hq(Response.json(choose)),
    )
    expect(await res.json()).toEqual(choose)
  })
})
