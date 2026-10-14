// POST /guest/lookup: a guest's name in, their page out. Outside /api/ on
// purpose — the zone's rate limit on /api/ allows ten requests per ten seconds
// per IP, and guests on one venue's Wi-Fi or one mobile carrier share an IP.
// The handler is src/lib/guestLookupProxy.ts, where it is typed and tested.
// The schedule is bundled into this Function, never into the browser's JS:
// data/ is outside src/ for exactly that reason.
import { handleLookup, type CatalogEvent, type LookupEnv } from '../../src/lib/guestLookupProxy'
import catalog from '../../data/schedule-events.json'

const events = catalog.events as CatalogEvent[]

export const onRequestPost = ({ request, env }: { request: Request; env: LookupEnv }) =>
  handleLookup(request, env, events)
