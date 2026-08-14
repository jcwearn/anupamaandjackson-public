# Plan: Gated Schedule page from With Joy tags

## Context

With Joy gates its schedule per guest — everyone sees the Muhurtham and the lunch, and only
invited guests see the Pellikuthuru, the Welcome Celebration, the Reception, the Golkonda hotel
days, and the Kerala trip. `/schedule` reproduces that on our own site.

Requirement that shaped the design: **no guest list may appear in plaintext client-side.** The
guest list is small and names are guessable, so a hashed roster would fall to a wordlist in
seconds. Hiding *who is invited* also isn't enough on its own — shipping the Pellikuthuru's venue
and time in the JS bundle defeats the point — so private event copy is encrypted too.

Brute-force resistance is explicitly **not** a goal. Anyone who knows a guest's name can decrypt
that guest's record; that is the intended access path. The KDF only raises the cost of bulk
decryption.

## Architecture

```
With Joy ──(existing daily export)──> Google Sheet ('latest' tab)
                                          │
                    GitHub Action (daily cron + workflow_dispatch)
                    scripts/build-schedule-index.js
                                          │
                            public/schedule-index.json  (encrypted, committed)
                                          │
                    useGuestSchedule → name → PBKDF2 → AES-GCM → events
```

No backend, no KV, no Cloudflare Functions, no secrets in Cloudflare, no session cookies, no rate
limiting. Pushing the regenerated index to `main` triggers the existing Pages deploy.

## Data model

`data/schedule-events.json` is the source of truth for every event and lives **outside `src/`** so
it can never be imported into the bundle. Each entry declares a `gate` — a With Joy tag name, or
an array meaning any-of.

| Event | Gate | Guests |
|---|---|---|
| Pellikuthuru | `pellikuthuru` | 199 |
| Check-in, High Tea, Farewell Breakfast, Checkout | `[hotel-golkonda-covered, hotel-golkonda-own]` | 117 |
| Welcome Celebration & Edurukolu | `sangeet` | 319 |
| Wedding Ceremony & Muhurtham, Traditional South Indian Lunch | `muhurtam` | 620 |
| Reception & Dinner | `reception` | 571 |
| Optional weekend trip to Kerala (links to `/kerala-itinerary`) | `optional-trip` | 198 |

The two `muhurtam` events are marked `universal` and duplicated in `src/data/scheduleEvents.ts` so
the prerendered page paints instantly and still renders if the index fails to load. The generator
fails the build if the two copies drift.

### Export gotchas

- Read the **`latest`** sheet. The workbook also has `Summary`, `Parental Responses`, and a dated
  sheet per day.
- Columns **O–V are RSVP responses**; **W–AU are invitation tags**. Gate on the tags. 343 guests
  have a blank `muhurtham` response but 620 carry the `muhurtam` tag.
- The source spells it **`muhurtam (tag)`**, with one `h`.
- Tag values are floats (`1.0`/`0.0`), not booleans.
- `#N/A` leaks into columns as a literal string and is treated as blank.
- Tag columns are located by the `' (tag)'` header suffix, not column letter, because the exporter
  appends columns over time.

## Design decisions worth keeping

**Name normalization is one shared module** (`src/lib/guestName.js`), imported by both the Node
generator and the browser. Both feed identical strings into the same SHA-256 and PBKDF2; two
implementations drifting would silently make every guest unfindable. Node 19+ exposes the
browser's `crypto.subtle`, so the crypto module is shared the same way.

**The key separator is NUL.** With a space, `'Subba Rao' + 'Duvvuri'` and `'Subba' + 'Rao Duvvuri'`
both flatten to `subba rao duvvuri` and resolve to each other's records.

**Honorific stripping excludes sri/shri/smt.** `Srilakshmi` is a real first name on the list.

**Hashing makes fuzzy matching impossible** — a misspelling is simply a miss. Mitigated by
indexing each guest under several aliases (multi-token first names, run-together spellings, blank
last names, unaccented forms, envelope name) and by a clear not-found path pointing to Joy.

**Five name pairs are genuinely different people, not duplicates.** Where their invite sets match
the records collapse silently; where they differ both are kept with a household hint from the
`party` column and the guest picks. The build **fails loudly** if differing guests can't be told
apart — union would leak one guest's private events to the other, and intersection would silently
strip events. Verified: the three differing pairs all have distinct `party` values.

**The remembered household is stored as the hint text, not a bucket position.** Bucket order
follows roster row order, so a stored position would start pointing at the other household the
first time a row was inserted above them.

**The index can't be byte-stable** (salt and every AES-GCM IV must be random; IV reuse under one
key breaks confidentiality). So the generator fingerprints its *inputs* and skips republishing
when the roster and catalog are unchanged, which keeps the daily sync a no-op commit.

## Verification

- `npm test` — normalization, aliasing, gate resolution, collision handling, build guards,
  encrypt/decrypt round trip, and the privacy invariants.
- `npm run sync:schedule:dry` — counts only, never names.
- Bundle check before merging: no guest surname, and no private event address, in
  `dist/assets/*.js`, `dist/**/index.html`, or `public/schedule-index.json`.
