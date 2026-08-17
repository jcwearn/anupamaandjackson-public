# Covering part of a guest's share

Sometimes we decide to pay part of what a guest owes for the Kerala trip. The
travel agent knows nothing about it: they invoice that guest at the ordinary card
rate, and the money moves between us and the guest only.

This is the process for setting one up. It is data-only — no code change.

## Which field to reach for

Three fields can move a Kerala price, and picking the wrong one puts the money in
the wrong column. They live on a row in `data/kerala-trip-responses.json`.

| Field           | Means                                                 | Moves what the agent bills? |
| --------------- | ----------------------------------------------------- | --------------------------- |
| `hostCovers`    | We are paying part of this guest's share ourselves    | **No**                      |
| `soleUseNights` | The agent charges us more than the card for this stay | Yes, upward                 |
| `priceOverride` | The guest was quoted a figure nothing else can derive | Yes                         |

`hostCovers` is the only one of the three that changes what a guest owes without
changing what we owe. That is the whole reason it is its own field rather than a
smaller `priceOverride`:

- an override would quietly cut the total we owe the agent by the amount we are
  covering — money they are still going to ask for;
- and it would file the guest under **Price exception** in _How the total breaks
  down_, which is the table read back against the agent's invoice and shared with
  them. From their side there is no exception. Nothing about the quote went
  wrong; we just decided to pay part of it.

They compose, so a guest can have both. `hostCovers` comes off whichever figure
the other two settled on.

## The arithmetic

`hostCovers` is in **rupees**, like every other figure in that file — quotes come
in rupees and the dollars guests see are derived. But the decision is usually
made in dollars ("I'll cover $244"), so work backwards from the dollar figure you
want the guest to see:

```
hostCovers = cardRate − round(targetUsd × QUOTED_AT_INR_PER_USD)
```

`QUOTED_AT_INR_PER_USD` is in `src/lib/keralaPricing.ts` (95.31 at the time of
writing). Use that constant, not `INR_PER_USD` — they are equal today and mean
different things, and this is a figure someone is being asked for once.

Worked example, for a guest on the full itinerary, single occupancy, round trip,
whose card rate is ₹90,000 (= $944), who should be asked for $700:

```
700 × 95.31 = 66,717
90,000 − 66,717 = 23,283      →  "hostCovers": 23283
```

Deriving it this way rather than converting $244 directly is what makes the
guest's price land on exactly $700 instead of a dollar either side of it. The
covered figure then reads $244.29 on the admin page — the 29¢ is rounding that
was already inside "$944", not a new error.

`hostCovers` must be positive and smaller than the price it comes off. The sync
checks what it can, but it cannot see the rate card (that is TypeScript, and the
generator is plain Node), so check the ceiling yourself.

## Doing it

1. Work out `hostCovers` as above.
2. Add it to the guest's row in `data/kerala-trip-responses.json`, along with a
   `priceNote` telling them what happened. The note renders verbatim in a peach
   callout under their price on `/kerala-itinerary`, so write it to them.
   - Their own card will show the reduced price, while the shared rate table
     further down the page keeps quoting the card rate. That is intended, and the
     note is what reconciles the two — so **say both figures in the note**.
   - ASCII apostrophes, matching the rest of the file.
3. `npm run sync:schedule:local:dry`, read it, then `npm run sync:schedule:local`.
4. Check the three places on `/admin/kerala-trip`:
   - **You are covering** gains a line for them, hinted "part of their price is on
     you" — distinct from the "quoted before the sole-use night was costed" hint,
     which is a different situation.
   - **Still to collect** shows them at the reduced figure.
   - **How the total breaks down** is unchanged: same total, same rate rows, no
     new "Price exception" row, and they stay in the rate bucket they were always
     in. Expanding _their_ rate row will show a "You cover the difference" line —
     that is the only place in that table where any of this appears, and the
     collapsed view and its Save-as-PNG export are unaffected.
5. Commit. **The commit message must not name them** — see `CLAUDE.md`.

## Where it lives in the code

- `src/lib/keralaPricing.ts` — `keralaPrice` subtracts it; `keralaAgentCost` adds
  it straight back on, which is what keeps it out of the agent's total.
- `src/lib/keralaTripSummary.ts` — emits a `gift` line under `coveredBy`, and
  deliberately does _not_ count it as a bucket `exception`.
- `scripts/lib/scheduleIndex.js` — validates it, and copies it into both the
  guest's envelope and the admin one. It is the only price field that belongs in
  both: the guest needs it to see the right price, and the admin page needs it to
  know the difference is ours.
