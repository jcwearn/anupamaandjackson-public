// POST /guest/lookup: a guest's name in, their page out. Outside /api/ on
// purpose — the zone's rate limit on /api/ allows ten requests per ten seconds
// per IP, and guests on one venue's Wi-Fi or one mobile carrier share an IP.
// The handler is src/lib/guestLookupProxy.ts, where it is typed and tested.
import { handleLookup, type LookupEnv } from '../../src/lib/guestLookupProxy'

export const onRequestPost = ({ request, env }: { request: Request; env: LookupEnv }) =>
  handleLookup(request, env)
