# Refreshing the Kerala data from Wedding HQ

Wedding HQ has been the source of truth for the Kerala trip since 2026-10-13.
Rooms, responses, prices, guest payments and the agent's billing are all
edited there, at hq.anupamaandjackson.com/kerala. This site still builds every
guest's Kerala card (and, until the admin pages move, `/admin/kerala-trip`) from
`data/kerala-trip-responses.json`, which nothing updates any more. Left alone it
drifts: the first time, HQ had recorded the agent's balance payment and dropped
the paid-off schedule entry, and this site was still showing both the old way.

This is the process for bringing the file back in line. Run it after any Kerala
edit in HQ. It is temporary — once guests look themselves up through HQ
directly (`docs/plans/hq-backend/`), the file and this doc are deleted.

**Edit in HQ, never in the JSON.** The next refresh rewrites the file from HQ and
an edit made only here is silently lost. That includes the fields
`docs/covering-a-guest-share.md` describes: each one is a column on the guest's
row in HQ (`host_covers_inr`, `sole_use_nights`, `price_override_inr`,
`invoiced_inr`, `seat_transfer_inr`).

## 1. Fetch from HQ

The Access service token comes from `../wedding-hq/.env` through direnv. Keep
the fetched files outside the repo — they are full of guest names and emails,
and `/api/guests` carries addresses and phone numbers too.

```sh
OUT=$(mktemp -d)
for e in kerala_responses kerala_rooms kerala_agent_payments kerala_agent_schedule guests; do
  curl -sf -o "$OUT/$e.json" \
    -H "CF-Access-Client-Id: $WEDDING_HQ_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $WEDDING_HQ_CLIENT_SECRET" \
    "https://hq.anupamaandjackson.com/api/$e?limit=1000" || echo "failed: $e"
done
```

A 302 means Access turned the token away; check direnv loaded it.

## 2. Rebuild the file

The conversion is the inverse of HQ's one-off import (`importKerala` in
wedding-hq's `src/worker/kerala.ts`):

| File field                       | HQ                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `room`                           | `kerala_rooms.number` of the response's `room_id`                            |
| `bed`                            | the room's `bed`, on doubles only                                            |
| `payment`                        | `{usd, to, via}` from `payment_usd`, `payment_to`, `payment_via`             |
| `host`                           | `true` when `host` is 1                                                      |
| `priceOverride`, `hostCovers`, … | the matching `_inr` column; `soleUseNights` and `priceNote` keep their names |
| `name`                           | the linked guest's first and last name, only where their email is shared     |
| `billing.payments` / `.schedule` | `kerala_agent_payments` / `kerala_agent_schedule`, archived rows left out    |

`name` is the tie-breaker the generator uses when a With Joy plus-one shares the
invitee's email; HQ links each response to its guest by id, so the name is read
from there rather than guessed. Rows are matched exactly — never fuzzily — and
the script refuses a response whose room or guest is archived.

The script keeps the current file's row order and key order, so `git diff`
shows only what actually changed, and reports counts, never names:

```js
// Usage: node kerala-from-hq.mjs <dir with HQ json> <current data file> <out file>
import { readFileSync, writeFileSync } from 'node:fs'
const [dir, currentPath, outPath] = process.argv.slice(2)
const load = (n) => JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8')).results
const live = (rows) => rows.filter((r) => !r.archived_at)
const responses = live(load('kerala_responses'))
const rooms = new Map(live(load('kerala_rooms')).map((r) => [r.id, r]))
const guests = new Map(
  load('guests')
    .filter((g) => !g.archived_at)
    .map((g) => [g.id, g]),
)
const payments = live(load('kerala_agent_payments')).sort(
  (a, b) =>
    (a.paid_on ?? '').localeCompare(b.paid_on ?? '') || a.created_at.localeCompare(b.created_at),
)
const schedule = live(load('kerala_agent_schedule')).sort((a, b) => a.due.localeCompare(b.due))
const current = JSON.parse(readFileSync(currentPath, 'utf8'))

const emailOwners = new Map()
for (const g of guests.values())
  for (const e of Array.isArray(g.emails) ? g.emails : JSON.parse(g.emails || '[]'))
    emailOwners.set(e, (emailOwners.get(e) ?? 0) + 1)

const problems = []
const built = responses.map((r, i) => {
  const room = rooms.get(r.room_id)
  const g = guests.get(r.guest_id)
  if (!room) problems.push(`response ${i + 1}: room missing or archived`)
  if (!g) problems.push(`response ${i + 1}: guest missing or archived`)
  const out = { email: r.email }
  if ((emailOwners.get(r.email) ?? 0) > 1)
    out.name = `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim()
  Object.assign(out, { trip: r.trip, flight: r.flight, occupancy: r.occupancy })
  if (r.occupancy === 'double' && room?.bed) out.bed = room.bed
  out.room = room?.number
  if (r.host) out.host = true
  if (r.payment_via)
    out.payment = {
      ...(r.payment_usd != null ? { usd: r.payment_usd } : {}),
      ...(r.payment_to ? { to: r.payment_to } : {}),
      via: r.payment_via,
    }
  if (r.invoiced_inr != null) out.invoiced = r.invoiced_inr
  if (r.seat_transfer_inr != null) out.seatTransfer = r.seat_transfer_inr
  if (r.price_note != null) out.priceNote = r.price_note
  if (r.display_name != null) out.displayName = r.display_name
  if (r.price_override_inr != null) out.priceOverride = r.price_override_inr
  if (r.sole_use_nights != null) out.soleUseNights = r.sole_use_nights
  if (r.host_covers_inr != null) out.hostCovers = r.host_covers_inr
  return {
    out,
    guestKey: `${r.email}|${(g?.first_name ?? '').toLowerCase()}|${(g?.last_name ?? '').toLowerCase()}`,
  }
})
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

// Keep the current file's order and key order so the git diff shows only real changes.
const keyOf = (r) => r.email
const used = new Set()
const ordered = []
for (const old of current.responses) {
  const idx = built.findIndex(
    (b, i) =>
      !used.has(i) &&
      keyOf(b.out) === keyOf(old) &&
      (!old.name ||
        b.out.name === undefined ||
        b.out.name.toLowerCase() === old.name.toLowerCase()),
  )
  if (idx === -1) continue
  used.add(idx)
  const b = built[idx].out
  if (old.name && !b.name) b.name = old.name // keep a tie-breaker the file already had
  const keys = [
    ...Object.keys(old).filter((k) => k in b),
    ...Object.keys(b).filter((k) => !(k in old)),
  ]
  ordered.push(Object.fromEntries(keys.map((k) => [k, b[k]])))
}
built.forEach((b, i) => {
  if (!used.has(i)) ordered.push(b.out)
})

const file = {
  _source: current._source,
  responses: ordered,
  billing: {
    _source: current.billing._source,
    payments: payments.map((p) => ({
      ...(p.paid_on ? { date: p.paid_on } : {}),
      amount: p.amount_inr,
      ...(p.note ? { note: p.note } : {}),
    })),
    schedule: schedule.map((s) => ({
      due: s.due,
      ...(s.pct != null ? { pct: s.pct } : {}),
      ...(s.note ? { note: s.note } : {}),
    })),
  },
}
writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n')

// Counts-only comparison, never names or emails.
const fields = new Set()
let same = 0,
  changed = 0
for (const n of ordered) {
  const o = current.responses.find(
    (x) =>
      x.email === n.email && (!x.name || !n.name || x.name.toLowerCase() === n.name.toLowerCase()),
  )
  if (!o) continue
  const diff = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter(
    (k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]),
  )
  diff.length ? (changed++, diff.forEach((k) => fields.add(k))) : same++
}
console.log({
  responses: {
    before: current.responses.length,
    after: ordered.length,
    appended: built.length - used.size,
    unchanged: same,
    changed,
    changedFields: [...fields],
  },
  payments: { before: current.billing.payments.length, after: file.billing.payments.length },
  schedule: { before: current.billing.schedule.length, after: file.billing.schedule.length },
})
```

Save it outside the repo and run it:

```sh
node kerala-from-hq.mjs "$OUT" data/kerala-trip-responses.json "$OUT/kerala-new.json"
```

## 3. Check before replacing the file

The counts should show exactly the edits you made in HQ. The first run, for
example, had 48 of 48 responses unchanged, one agent payment added and one
schedule entry removed. Anything else — a response appended, a field you did not
touch — is a reason to stop and look before going further.

Then:

```sh
cp "$OUT/kerala-new.json" data/kerala-trip-responses.json
npm run sync:schedule:local:dry   # guestCount should not move
npm run sync:schedule:local       # the fingerprint covers the Kerala file; no --force
git diff --stat                   # the data file and public/schedule-index.json, nothing else
rm -r "$OUT"
```

Check that `guestCount` in the new index is the real roster's, not the fixture's.
Commit both files with a message that names nobody.
