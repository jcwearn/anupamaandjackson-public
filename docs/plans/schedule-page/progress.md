# Progress: Gated Schedule page

## Current Status: In Progress — code complete, setup pending

| Phase | Status | Updated | Notes |
|-------|--------|---------|-------|
| 1. Schedule page, universal events | Complete | 2026-07-27 | `/schedule` prerenders; sticky date headings; nav item added |
| 2. Catalog + index generator | Complete | 2026-07-27 | `data/schedule-events.json`, `scripts/build-schedule-index.js`; verified against the real 621-guest export |
| 3. Client decryption + UI states | Complete | 2026-07-27 | `useGuestSchedule`; anonymous / resolving / ambiguous / identified / notFound / error |
| 4. Daily sync workflow | Complete (unconfigured) | 2026-07-27 | Workflow committed; **GitHub secrets not yet set, so it will fail until they are** |
| 5. Tests + docs | Complete | 2026-07-27 | 34 vitest tests; this folder |

## Outstanding

1. **Run the one-time setup** — GCP project, service account, sheet share, and the three GitHub
   secrets. Step-by-step instructions with a troubleshooting table are in the README under
   *Schedule index → One-time setup*. Until it's done the scheduled run fails; the committed
   bootstrap index keeps the page working in the meantime.
3. **Confirm the Oct 27–29 venue.** Only Pellikuthuru had an explicit address in the supplied
   copy; everything else is currently labelled "Golkonda Resort" on the assumption it's all there.
4. **One guest carries no gating tag** (row 153, party "Ramamurthi") and is absent from the index,
   so they'd be told we can't find them. Either a data gap in With Joy or genuinely uninvited.

Decided against: distinguishing the 29 `hotel-golkonda-covered` guests from the 88
`hotel-golkonda-own` guests in the check-in copy. Both see the same wording.

## Verified in the browser (2026-07-27)

puppeteer-core against the preview build, desktop 1280px and mobile 390px:

- Anonymous, resolving, ambiguous, identified and not-found states all render correctly.
- A guest with six tags gets all ten events under four correct date headings.
- The real `Vidya Tadanki` collision prompts for a household; choosing "Anirudh Tadanki"
  narrows ten events to four, i.e. resolves to the right record.
- Sticky date headings pin under the nav and take their opaque background on scroll.
- No horizontal overflow at 390px; no console errors.

**Note for future verification:** request `/schedule/` **with a trailing slash** on port 4173.
Without it `vite preview` serves `dist/index.html`, and the resulting hydration mismatch looks
like a bug in the page under test. Production is unaffected — Cloudflare Pages 308-redirects to
the trailing slash, confirmed against the live site.

## Handoff Notes

`public/schedule-index.json` is committed as a **bootstrap**, generated locally from the saved
`With Joy Export.xlsx` rather than from the live sheet. The first successful Action run replaces
it. It contains real (encrypted) guest data — the same artifact the Action produces daily.

The generator skips writing when the roster fingerprint is unchanged, so re-running it locally is
safe and produces no diff.

To work on this without credentials: `npm run sync:schedule:fixture` builds an index from the
synthetic fixture in `tests/fixtures/guests.sample.csv`. Do **not** commit an index built from the
fixture — production would serve fake guests.
