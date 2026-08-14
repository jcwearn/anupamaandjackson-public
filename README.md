# Anupama & Jackson

The wedding site at **[anupamaandjackson.com](https://anupamaandjackson.com)** — schedule,
travel, dress code, RSVP and an eVisa helper for guests travelling to Hyderabad.

> **This is a read-only published snapshot.** Development happens in a private
> repo; a CI job mirrors the filtered tree here on every merge. Issues and pull
> requests opened here won't sync back upstream, and commits here will be
> overwritten by the next sync. Feel free to read, fork, and steal ideas.

React 19 + TypeScript on Vite, deployed to Cloudflare Pages.

## The interesting part: per-guest pages without a login

Guests each see a different schedule — some are invited to the Kerala trip, some to a
subset of events, some have a roommate and a price. Doing that the ordinary way means
accounts, sessions and a backend. This site is static.

Instead, every guest's record is encrypted client-side under a key derived by PBKDF2
from that guest's own name, and all of them ship together in one index. Enter your name,
the browser derives the key and decrypts the one envelope that opens — the schedule,
what to wear, the Kerala itinerary and your own trip details. Nothing else in the file
is readable, and the server never learns who you are because it was never asked.

The honest caveat, which is also in the source: this is not a security boundary. The
guest list is small and names are guessable, so anyone willing to run a dictionary gets
in. It is a courtesy that keeps one guest from idly reading another's arrangements, not
a lock.

The encrypted index itself is **not** in this snapshot. Serving one current copy from
the live site is a different proposition from publishing every historical revision into
somewhere archived and searchable forever.

## Also here

- **Prerendering.** An SSR entry plus a prerender script emit static HTML per route, each
  with its own Open Graph image generated at 1200×630 by headless Chrome from a manifest.
- **A daily sync.** A GitHub Action pulls the guest roster from Google Sheets and
  regenerates the encrypted index, so RSVP changes reach the site without a deploy.
- **An eVisa helper.** The India e-visa form wants photographs to precise specifications;
  this walks guests through it, including client-side image conversion and compression.

## What is filtered out

Guest data. The roster, the RSVP exports and the responses file that records room
pairings all stay in the private repo — see `.publicignore`, which is published so you
can see exactly what is held back. The tests here run against synthetic fixtures.

## License

MIT. See [LICENSE](LICENSE).
