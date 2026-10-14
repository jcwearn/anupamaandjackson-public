// defineConfig comes from vitest/config — a superset of vite's — so the `test`
// block below is typed. The build behaves exactly as before.
import { defineConfig, type Plugin } from 'vitest/config'
import type { Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleLookup, type CatalogEvent } from './src/lib/guestLookupProxy'
import catalog from './data/schedule-events.json'

/**
 * Serves POST /guest/lookup under `npm run dev` and `npm run preview`, where
 * Pages Functions do not run, with the same handler the production Function
 * uses. The Access token comes from the shell: direnv loads wedding-hq's into
 * this repo (.envrc), so a local lookup reaches real HQ data, and without it
 * the lookup answers 503 and the site falls back the way it would in
 * production.
 */
function guestLookup(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url !== '/guest/lookup' || req.method !== 'POST') return next()
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      const response = await handleLookup(
        new Request('http://localhost/guest/lookup', {
          method: 'POST',
          body: Buffer.concat(chunks),
        }),
        process.env,
        catalog.events as CatalogEvent[],
      )
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(await response.text())
    })
  }
  return {
    name: 'guest-lookup',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), guestLookup()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
