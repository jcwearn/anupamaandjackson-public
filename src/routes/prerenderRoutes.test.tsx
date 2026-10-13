import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '../entry-server'
import { routes, readRedirects } from '../../scripts/prerender.js'
import { HQ_TOOLS } from '../lib/hqTools'

beforeAll(() => {
  // Landing and the invites read matchMedia and IntersectionObserver on mount;
  // jsdom has neither, and renderToString touches them through the layouts.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

// Every path the build writes a file for.
const prerendered = routes.map((route) => route.path)

/** The old URLs public/_redirects has to keep working, and where each now lives. */
const LEGACY = [['/travel-tips', '/travel/tips']] as const

/**
 * Paths whose tools moved to Wedding HQ, and the HQ page each now goes to. The
 * last two are the even older URLs that used to 301 to the /admin versions.
 */
const MOVED_TO_HQ = [
  ['/admin/invite-links', 'https://hq.anupamaandjackson.com/invite-links'],
  ['/admin/guest-summary', 'https://hq.anupamaandjackson.com/guests'],
  ['/admin/kerala-trip', 'https://hq.anupamaandjackson.com/kerala'],
  ['/invites/links', 'https://hq.anupamaandjackson.com/invite-links'],
  ['/guest-summary', 'https://hq.anupamaandjackson.com/guests'],
] as const

/** public/_redirects as Pages will read it: one [from, to, status] per rule. */
const redirects = readRedirects()

describe('prerendered routes', () => {
  // The route table is written out three times — main.tsx for the browser,
  // entry-server.tsx for the prerender, and prerender.js for the file list —
  // and nothing makes them agree. A path in prerender.js that entry-server
  // doesn't serve doesn't fail the build: it hits the catch-all and quietly
  // ships a page that redirects home.
  it('every prerendered path is served by the SSR router', () => {
    expect(prerendered.length).toBeGreaterThan(0)

    for (const path of prerendered) {
      const html = render(path)
      expect(html, `${path} rendered nothing`).not.toBe('')
    }
  })

  it('no prerendered path falls through to the catch-all', () => {
    // The catch-all is <Navigate to="/" replace />, which renders as nothing at
    // all on the server — so an unmatched path is an empty string, and a page
    // that looks fine locally is blank in production.
    const home = render('/')

    for (const path of prerendered) {
      if (path === '/') continue
      expect(render(path), `${path} renders the landing page`).not.toBe(home)
    }
  })

  // public/_redirects 301s each of these to its new home. Cloudflare Pages
  // serves a matching static file in preference to a redirect rule, so emitting
  // an old path would silently shadow its redirect — the page would still work,
  // and every link out in the world would keep landing on the stale copy.
  it.each(LEGACY)('redirects %s without prerendering it', (from, to) => {
    expect(prerendered).not.toContain(from)
    expect(prerendered).toContain(to)
  })

  it.each(MOVED_TO_HQ)('does not prerender %s, which moved to HQ', (from) => {
    // Same shadowing as above: a static file at the old path would be served in
    // place of the redirect, and the family would land on an empty page.
    expect(prerendered).not.toContain(from)
  })

  it('keeps only the hub under /admin', () => {
    const admin = prerendered.filter((path) => path === '/admin' || path.startsWith('/admin/'))

    expect(admin).toEqual(['/admin'])
  })

  it('serves the Travel section under one parent path', () => {
    const travel = prerendered.filter((path) => path === '/travel' || path.startsWith('/travel/'))

    expect(travel.sort()).toEqual(['/travel', '/travel/food', '/travel/hyderabad', '/travel/tips'])
  })
})

describe('legacy redirects', () => {
  it.each(LEGACY)('sends %s to %s in both its forms', (from, to) => {
    // Pages matches the path literally, so the trailing-slash form needs a rule
    // of its own. Without one it falls through to the SPA shell and only the
    // client-side HashRedirect puts it right — which is no help at all when a
    // stale copy of the old page is what the cache hands back.
    for (const source of [from, `${from}/`]) {
      const rule = redirects.find(([path]) => path === source)

      expect(rule, `public/_redirects has no rule for ${source}`).toBeDefined()
      // The trailing slash is the form the prerendered page actually lives at;
      // without it this 301 lands on Pages' own 308 and costs a second hop.
      expect(rule?.[1], `${source} should point at ${to}/`).toBe(`${to}/`)
      expect(rule?.[2], `${source} should be a permanent redirect`).toBe('301')
    }
  })

  it.each(MOVED_TO_HQ)('sends %s to %s in both its forms, temporarily', (from, to) => {
    for (const source of [from, `${from}/`]) {
      const rule = redirects.find(([path]) => path === source)

      expect(rule, `public/_redirects has no rule for ${source}`).toBeDefined()
      expect(rule?.[1]).toBe(to)
      // 302 so that rolling the move back is not undone by every admin's
      // browser remembering a permanent redirect.
      expect(rule?.[2], `${source} should be a temporary redirect`).toBe('302')
    }
  })

  it('sends the old admin URLs to the same HQ pages the hub links to', () => {
    const hubLinks: string[] = HQ_TOOLS.map((tool) => tool.href)

    for (const [, to] of MOVED_TO_HQ) expect(hubLinks).toContain(to)
  })

  it('points every on-site redirect at a page the build actually writes', () => {
    // A rule aimed at a path that is not prerendered sends the reader to the
    // SPA fallback, which is exactly the hole these rules exist to close.
    expect(redirects.length).toBeGreaterThan(0)

    for (const [from, to] of redirects.filter(([, target]) => target.startsWith('/'))) {
      expect(prerendered, `${from} points at ${to}, which is not prerendered`).toContain(
        to.replace(/\/$/, ''),
      )
    }
  })
})
