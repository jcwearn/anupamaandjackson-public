import { describe, it, expect, vi } from 'vitest'
import { handleLookup } from './guestLookupProxy'

const ENV = { WEDDING_HQ_CLIENT_ID: 'id.access', WEDDING_HQ_CLIENT_SECRET: 'secret' }

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

    const res = await handleLookup(post({ first: 'Ada', last: 'Lovelace' }), ENV, fetchImpl)

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
      fetchImpl,
    )

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      first: 'Ada',
      last: 'Lovelace',
      email: 'ada@example.com',
    })
  })

  it.each([
    ['not JSON', 'nope'],
    ['no name', {}],
    ['a name that is not text', { first: 1, last: 'Lovelace' }],
    ['an oversized name', { first: 'x'.repeat(101), last: 'Lovelace' }],
  ])('refuses %s without asking HQ', async (_, body) => {
    const fetchImpl = hq(Response.json({}))

    const res = await handleLookup(post(body), ENV, fetchImpl)

    expect(res.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed where no token is configured', async () => {
    const fetchImpl = hq(Response.json({}))

    const res = await handleLookup(post({ first: 'Ada', last: 'Lovelace' }), {}, fetchImpl)

    expect(res.status).toBe(503)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['Access turning the token away', new Response(null, { status: 302 })],
    ['HQ refusing it', new Response('{}', { status: 403 })],
    ['namesakes HQ cannot tell apart', new Response('{}', { status: 409 })],
    ['HQ failing', new Response('{}', { status: 500 })],
  ])('says the lookup is unavailable on %s', async (_, response) => {
    const res = await handleLookup(post({ first: 'Ada', last: 'Lovelace' }), ENV, hq(response))

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'lookup unavailable' })
  })

  it('says the lookup is unavailable when HQ cannot be reached at all', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network')
    })

    const res = await handleLookup(post({ first: 'Ada', last: 'Lovelace' }), ENV, fetchImpl)

    expect(res.status).toBe(503)
  })
})
