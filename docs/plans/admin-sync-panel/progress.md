# Progress: A sync panel on /admin

## Current Status: Phase 1 complete, phases 2–3 not started

| Phase | Status | Updated | Notes |
|-------|--------|---------|-------|
| 1. Consolidate the admin pages under `/admin` | Complete | 2026-08-16 | `AdminLayout` owns both gates; `/invites/links` and `/guest-summary` 301 to their new homes |
| 2. Sync button (Pages Function + Access) | Not Started | — | Only this repo changes. Proves the Access + Function path before the exporter is touched |
| 3. Export button and Run Both | Not Started | — | Needs a new `workflow_dispatch` workflow in `jcwearn/withjoy-exporter` |

## What phase 1 shipped

- `src/layouts/AdminLayout.tsx` — the gate ladder, page chrome, section nav and
  "Forget this device", all in one place. Hands the decrypted roster down the
  outlet, so a tool reads it with `useAdminContext()` rather than unlocking again.
- `src/routes/AdminIndex.tsx` — the tool list at `/admin`.
- `InviteLinks.tsx` and `GuestSummary.tsx` reduced to their contents.
- `ADMIN_NAV_ITEMS` in `src/lib/navItems.ts` drives both the chip row and the
  index page, so a tool added to one cannot be missing from the other.
- Old paths 301 in `public/_redirects` and `HashRedirect` client-side, and are
  no longer prerendered — `prerenderRoutes.test.tsx` asserts that for all three
  redirected paths now, not just `/travel-tips`.

**The section is unlocked once, not once per tool.** That is the behavioural
change; everything else is a move.

## Handoff notes for phase 2

Read `plan.md` first — particularly *Why the trigger auth is separate from the
admin passphrase*, which is the reasoning behind the whole design and the thing
most likely to look like over-engineering to someone arriving cold.

The four traps most likely to cost an afternoon, all confirmed rather than
guessed:

1. **The GitHub App private key is PKCS#1 and WebCrypto only accepts PKCS#8.**
   Convert it before storing it in Cloudflare, or you get an opaque `DataError`
   at runtime in production.
2. **The bare `<project>.pages.dev` alias serves production with production env
   vars**, and the "protect preview deployments" toggle does not cover it. The
   Function must validate the Access JWT itself; do not rely on Access being in
   front.
3. **Every `.js` under `functions/` becomes a public route** — including test
   files. Helpers live in `worker/`.
4. **`tsconfig.json` is `"include": ["src"]`**, so `functions/**/*.ts` would be
   silently untypechecked. Write plain `.js`.

Reference implementations worth reading before writing anything:
`withjoy-exporter/web.py` (status derivation, button-disable rules, the run-both
chain semantics) and `withjoy-exporter/github_sync.py` (dispatch and summarize
shapes — it already pins `ref` to `main` and targets one workflow file, so the
Function is a port of proven logic, not a new design).

Not yet decided: which email addresses go in the Access policy, and whether
`web.py` retires once both buttons exist here.
