# Plan: A sync panel on /admin

## Context

The With Joy guest list reaches this site through two jobs that run in different
places and are triggered from a third:

1. **Export** — With Joy → Google Sheet. A k3s CronJob at 06:00 America/New_York
   (`k3s-cluster/apps/withjoy-exporter/cronjob.yaml`). Playwright drives the real
   With Joy UI, because With Joy has no export API.
2. **Sync** — Google Sheet → `public/schedule-index.json`. This repo's
   `.github/workflows/refresh-schedule-index.yml`, cron `30 11 * * *` UTC,
   deliberately after the export.

A Flask UI in the exporter's own image (`withjoy-exporter/web.py`) already drives
both on demand — Run export, Sync schedule, Run both — with live status. It is
reachable only on the LAN and Tailnet, and it is unauthenticated. So it cannot be
the one-stop shop `/admin` is meant to be.

The goal is a `/admin/sync` page that does what that Flask page does, reachable
from anywhere, by the family admins as well as Jackson.

Phase 1 (the `/admin` consolidation) is **done** — see `progress.md`.

## Decisions already taken

| Question | Decision |
|---|---|
| Path to the jobs | Cloudflare Pages Function → GitHub API. **No inbound path to the k3s cluster** |
| Trigger auth | Cloudflare Access on `/admin/sync` + `/api/*` only |
| Access JWT | `@cloudflare/pages-plugin-cloudflare-access` (first-party) |
| Credential | Reuse the existing GitHub App, not a new PAT |
| k3s CronJob | Stays. GitHub Actions is the on-demand path only |
| Order | Sync first (this repo only), then the export |

### Why the trigger auth is separate from the admin passphrase

This is the load-bearing decision, so it is written down rather than rediscovered.

`src/lib/guestCrypto.js` says the guest layer is not meant to withstand a
determined attacker: guest keys derive from **names**, which are guessable. So
the `admin` tag is a UX gate, not a security boundary. The only real secret is
`ADMIN_PASSPHRASE` — short by choice, in ciphertext served publicly and
permanently, grindable offline at roughly 9,000 guesses/sec with no rate limit
and no signal to us.

That is proportionate for the roster. It is **not** proportionate for an endpoint
that pushes commits to `main` and logs into With Joy. An attacker grinds the
passphrase offline, then arrives at the endpoint with the right answer on the
first try — rate limiting the endpoint does nothing, because the guessing never
touched it.

So Access is an independent layer. Cracking the passphrase yields the roster, as
it already does today, and nothing more.

### Blast radius

The App holds `Actions: read/write` on one repo. No `Contents: write`, so a
caller cannot push code or alter a workflow and dispatch their own. No `Secrets`
permission, so `ADMIN_PASSPHRASE`, `GOOGLE_SA_PRIVATE_KEY` and the signing key
stay unreadable. The credential never leaves Cloudflare's edge — the browser
never sees it.

`Actions: write` is still broader than the two dispatches we need; it also
permits re-running, cancelling and deleting logs. **The Function is the
capability-narrowing layer**, which is why hardcoding the workflow file and
pinning the ref matters more than it looks.

The realistic abuse ceiling is denial of service — exhausting the 500-build/month
Pages quota, or tripping With Joy's Auth0 rate limits and locking a bot account
that has MFA disabled — not exfiltration.

## Phases

### Phase 2: The Sync button

Only this repo changes.

**Layout.** Two constraints dictate it:

- **Every `.js` under `functions/` becomes a public route.** A helper at
  `functions/api/sync/github.js` is fetchable at `/api/sync/github`; a test file
  there is fetchable too. Only entrypoints go under `functions/`.
- **Plain `.js`, not `.ts`.** `tsconfig.json` has `"include": ["src"]`, so
  `functions/**/*.ts` would be *silently untypechecked* by `tsc -b` — worse than
  honest JavaScript. `.js` matches `scripts/lib/`.

```
functions/api/_middleware.js    # Access plugin + host check
functions/api/sync/status.js    # GET  /api/sync/status
functions/api/sync/dispatch.js  # POST /api/sync/dispatch
worker/                         # pure modules — NOT routed
  jobs.js github.js cooldown.js ntfy.js
tests/worker/*.test.js
public/_routes.json
src/routes/AdminSync.tsx
```

The job registry is hardcoded in `worker/jobs.js` — the request never names a
repo, workflow or ref.

**Endpoints.**

- `GET /api/sync/status` → newest run: `state`, `runId`, `htmlUrl`, timestamps.
  State vocabulary mirrors `github_sync.summarize_run` so both UIs read alike,
  plus `none`, `unconfigured`, `error`. Degrade per-side like `web.py` does.
- `POST /api/sync/dispatch` → `202` dispatched, `409` a run is already active,
  `429` + `Retry-After` inside the cooldown, `502` GitHub refused, `503` no token.

**Status polling.** `workflow_dispatch` **now returns the run id** — a Feb 2026
change, after the Flask app was written — so `github_sync.find_run()`'s
5-second-window heuristic does not need porting. Placement of the
`return_run_details` parameter is unconfirmed and getting it wrong yields a
silent 204 with a null run id, so also add a `correlation_id` input and a
`run-name` line to the workflow and match on `display_title` as a fallback. Cheap,
and it makes the runs list readable anyway.

Client holds the state; the Function holds none. Poll every 4s while active,
**stop when terminal** (`web.py` polls forever at 3s, which is why it needs
`IDLE_REFRESH_SECONDS = 60`), re-poll on `visibilitychange`, cap at 40 minutes.
Cache the composed status JSON in `caches.default` for 5s.

**Session expiry mid-poll:** once the Access session lapses, `/api/sync/status`
answers a 302 to `cloudflareaccess.com` instead of JSON. Fetch with
`redirect: 'manual'`, treat an `opaqueredirect` as signed-out, stop polling, and
render a prompt whose button does a **full-page navigation** — a `fetch()` cannot
complete an Access login. The same path covers the SPA gap: `/admin` is not
Access-gated, so clicking through to `/admin/sync` fires no document request and
no challenge, and the first `/api` poll is where it surfaces.

**Cooldown without storage.** The GitHub API already carries the state. Before
dispatching, `GET …/runs`: any run not `completed` → 409; newest run started
within the cooldown → 429. No KV.

The eventual-consistency race is real but harmless:
`refresh-schedule-index.yml` already has `concurrency: refresh-schedule-index`,
so a duplicate queues then exits at "Index unchanged — nothing to commit", and
the client disables the button while a dispatch is in flight. Don't add storage
to close a window `concurrency:` already covers.

**Rate limiting** belongs in the WAF, not the code: a Cloudflare rule on
`/api/sync/dispatch`, 5 req/min per IP, applied before the Function is invoked.
Access already means only authenticated admins get there — this is a
runaway-loop guard, not anti-abuse.

**ntfy** fires in `ctx.waitUntil(...)` with `AbortSignal.timeout(5000)` and a
**mandatory `.catch()`**: a dead ntfy must never fail a dispatch GitHub already
accepted. The Function only observes *dispatch*, so add an `if: failure()` ntfy
step to the workflow too — each notification from the place that has the fact.
The Access plugin exposes `data.cloudflareAccess.JWT.payload.email`, so the
message can name who triggered it.

**Credentials.** Reuse the App from `withjoy-exporter/github_sync.py`; it is
already installed on `jcwearn/anupamaandjackson`, so this phase provisions no new
credential. Its private key moves into Cloudflare env.

The counter-argument, recorded honestly: a stateless Function has nowhere to
cache the installation token (`github_sync.py` uses a module global behind a
lock), so each cold invocation pays an extra `POST /app/installations/…` round
trip; a fine-grained PAT is one header with no crypto. The App wins here because
at this volume the extra call is irrelevant, while its hour-long tokens are
minted on demand where a PAT would sit long-lived in env, act as Jackson, and
need manual rotation before the wedding. **Revisit if phase 3 makes cross-repo
installation awkward.**

⚠️ **The App private key must be converted first.** GitHub issues these in PKCS#1
(`-----BEGIN RSA PRIVATE KEY-----`). PyJWT accepts it, which is why the Flask app
works — but WebCrypto's `importKey('pkcs8', …)` rejects it with an opaque
`DataError` at runtime, in production. Convert once and store the result:

```bash
openssl pkcs8 -topk8 -nocrypt -in app.pem -out app.pk8.pem
```

WebCrypto signs RS256 natively; **no `nodejs_compat` flag is needed**.

**Cloudflare Access — the pages.dev edge is the real threat.** An Access app on
the custom domain does **not** cover `<project>.pages.dev`, and the "protect
preview deployments" toggle covers only the random `<hash>.<project>.pages.dev`
URLs — **not** the bare alias, which serves the production deployment with
production env vars. This repo is mirrored publicly, so the endpoint path is
discoverable. Four layers, all of them:

1. The middleware **requires** a valid `Cf-Access-Jwt-Assertion`; absent is 403,
   never "Access must have handled it." This is the one that actually holds.
2. Reject unless the hostname equals `ALLOWED_HOST`.
3. **Set no secrets in the Preview environment** — no token means every preview
   deployment answers `503 unconfigured`. Cheapest half of the mitigation.
4. Enable Access on `*.pages.dev` *and* a separate app for the custom domain.

Pin the `aud`, or a token minted by any other Access app on the account is
accepted. Failures return an opaque 403 with no hint about which check failed.

**Build coexistence.** Adding `functions/` needs no Pages dashboard change —
`deployment.log:41` records `Note: No functions dir at /functions found.
Skipping.`, so the build already probes for it. `npm run build` is untouched.

Prerendering `/admin/sync` still works: prerendering is build-time, Access is
request-time. So `AdminSync.tsx` must not touch `window`, `localStorage` or
`fetch` during render — all of it in `useEffect`, as `adminUnlock.ts` already
does. Add `public/_routes.json` with `include: ["/api/*"]`; **verify after the
first deploy** that the auto-generated one is not `/*`, or every static page load
bills a Worker invocation.

**Tests.** `worker/` modules are plain ESM over injectable `fetch`/`crypto.subtle`,
so they unit-test in `tests/worker/` — never inside `functions/`.

- `github.test.js` — the run-state table. Pure, zero mocks.
- `cooldown.test.js` — 409/429/ok, table-driven, boundary at exactly the cutoff.
- `dispatch.test.js` — unknown job → 400 **with no fetch call** (the assertion
  that catches a refactor leaking user input into the URL); correct body; the 204
  fallback path; 5xx → 502; no token → 503.
- `ntfy.test.js` — a rejecting and a hanging ntfy leave the dispatch unchanged.
  Guards the `.catch()` that must never be removed.
- `AdminSync.test.tsx` — buttons disable while running, 429 surfaces
  `Retry-After`, an `opaqueredirect` renders the sign-in prompt, polling stops
  when terminal (`vi.useFakeTimers()`).
- `prerenderRoutes.test.tsx` — add `/admin/sync` to the admin-paths assertion.

Acceptance criteria: an enrolled admin can trigger a schedule refresh from
`/admin/sync` on a device with no Tailscale, watch it to completion, and get an
ntfy ping; an unauthenticated request to `/api/*` on either hostname gets 403.

### Phase 3: Export button and Run Both

New `workflow_dispatch` workflow in the **withjoy-exporter** repo. **No
`on: schedule`** — the k3s CronJob stays the sole scheduled export.

Run the **published GHCR image as the job container**, digest-pinned to what
`cronjob.yaml` uses, so Actions and k3s execute the same artifact. The exporter's
CLAUDE.md is explicit that it is Docker-only: there is no `pip install` path
because Playwright's browser binaries come from the base image. Needs
`options: --ipc=host` for Chromium, and the Google SA JSON written to a file with
the `install -m 600 /dev/null` + `if: always()` removal idiom lifted verbatim
from `refresh-schedule-index.yml`'s signing-key handling. `EXPORT_COLUMNS` is a
repo **variable**, not a secret — it is a schema pin, and `exporter.py` accepts
commas or newlines, so the ConfigMap value pastes in unchanged.

**Run Both belongs in the workflow's `needs:` graph**, not the browser. A
stateless Function cannot hold a 20-minute background task, and a client-side
chain dies with the tab. A `chain-sync` job gated on
`if: success() && inputs.run_sync` gets the same durability `web.py`'s daemon
thread has, and preserves the rule that matters: **a failed export must not
dispatch the sync**, or the index rebuilds from a stale or half-written sheet. It
needs its own non-container job — the image has no `gh`. Cross-repo
`workflow_run` is not an option; it only fires within one repository.

⚠️ **Do not upload debug artifacts on failure.** `exporter.py:_dump_debug` writes
full-page screenshots and raw HTML of the guest list; uploading those would put
guest PII into GitHub artifact storage — the exact category `.publicignore` works
to keep out of the public mirror. Only the pre-auth `login_failed` capture is safe.

Residual risk to document: `concurrency: withjoy-export` cannot see the k3s Job,
so a manual dispatch at 06:00 ET could interleave two writers on one Sheet. The
window is minutes wide and human-timed, and the exporter rewrites `latest` rather
than appending. The tidy end state is retiring the CronJob so `concurrency`
covers everything and `web.py` can go — a follow-up, not this phase.

## Open questions

- Which email addresses go in the Access policy? Phase 2 can ship with just
  Jackson's and add the family admins later.
- Does `web.py` retire once both buttons exist here, or stay as the on-Tailnet
  fallback? Leaning stay until `/admin/sync` has been used in anger.
