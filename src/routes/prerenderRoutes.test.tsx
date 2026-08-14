import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '../entry-server'
import { routes } from '../../scripts/prerender.js'

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
    }
  )
})

// Every path the build writes a file for.
const prerendered = routes.map((route) => route.path)

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

  it('does not prerender the old Travel Tips path', () => {
    // public/_redirects 301s /travel-tips to /travel/tips. Cloudflare Pages
    // serves a matching static file in preference to a redirect rule, so
    // emitting this path would silently shadow the redirect.
    expect(prerendered).not.toContain('/travel-tips')
    expect(prerendered).toContain('/travel/tips')
  })

  it('serves the Travel section under one parent path', () => {
    const travel = prerendered.filter((path) => path === '/travel' || path.startsWith('/travel/'))

    expect(travel.sort()).toEqual([
      '/travel',
      '/travel/food',
      '/travel/hyderabad',
      '/travel/tips',
    ])
  })
})
