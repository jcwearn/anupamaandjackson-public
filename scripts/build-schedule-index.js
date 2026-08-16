#!/usr/bin/env node
/**
 * Builds public/schedule-index.json from the With Joy export.
 *
 * Reads the `latest` sheet of the Google Sheet the daily exporter writes (or a
 * local CSV via --fixture), resolves each guest's invitation tags into events,
 * and writes an encrypted index. No guest name and no private event detail
 * appears in the output in plaintext.
 *
 *   node scripts/build-schedule-index.js --fixture tests/fixtures/guests.sample.csv
 *   node scripts/build-schedule-index.js --dry-run
 *   node scripts/build-schedule-index.js
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFixture, readGoogleSheet } from './lib/roster.js'
import {
  assertAdminTagExists,
  assertEveryGuestResolves,
  assertGatesExist,
  assertGolkondaAnswersRecognized,
  assertGolkondaColumnsExist,
  assertRosterPlausible,
  assertSummaryRsvpColumnsExist,
  assertSummaryTagsExist,
  assertUniversalEventsMatch,
  buildIndex,
  sourceFingerprint,
} from './lib/scheduleIndex.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = join(root, 'data', 'schedule-events.json')
const BUNDLED_PATH = join(root, 'src', 'data', 'scheduleEvents.ts')
const KERALA_RESPONSES_PATH = join(root, 'data', 'kerala-trip-responses.json')
const OUTPUT_PATH = join(root, 'public', 'schedule-index.json')

function parseArgs(argv) {
  const args = { dryRun: false, force: false, fixture: null, kerala: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true
    else if (argv[i] === '--force') args.force = true
    else if (argv[i] === '--fixture') {
      args.fixture = argv[i + 1]
      i += 1
    } else if (argv[i] === '--kerala') {
      args.kerala = argv[i + 1]
      i += 1
    }
  }
  return args
}

async function readPreviousIndex() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf-8'))
  } catch {
    return null
  }
}

async function loadRoster(fixture) {
  // resolve, not join: absolute fixture paths should be used as given.
  if (fixture) return readFixture(resolve(root, fixture))

  const { GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, SHEET_ID, SHEET_NAME } = process.env
  if (!GOOGLE_SA_EMAIL || !GOOGLE_SA_PRIVATE_KEY || !SHEET_ID) {
    throw new Error(
      'Set GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY and SHEET_ID, or pass --fixture <csv>.',
    )
  }
  return readGoogleSheet({
    clientEmail: GOOGLE_SA_EMAIL,
    privateKey: GOOGLE_SA_PRIVATE_KEY,
    sheetId: SHEET_ID,
    sheetName: SHEET_NAME || 'latest',
  })
}

/**
 * The key to the /guest-summary payload. Never committed: a line in .env
 * locally (gitignored, and excluded from the public mirror), and
 * secrets.ADMIN_PASSPHRASE in the nightly workflow.
 *
 * Missing is a hard failure rather than a warning, for the same reason the sync
 * workflow refuses to push unsigned: an index built without it would look
 * entirely normal and would publish the roster under a key nobody chose.
 *
 * The fixture path is the exception. It builds from 28 invented guests with no
 * network and no secrets — that is the whole point of it — so it takes a
 * constant, which is also what the test suites derive against.
 */
export const FIXTURE_ADMIN_PASSPHRASE = 'fixture-passphrase'

function adminPassphraseFor(fixture) {
  if (fixture) return FIXTURE_ADMIN_PASSPHRASE

  const passphrase = process.env.ADMIN_PASSPHRASE
  if (!passphrase) {
    throw new Error(
      'Set ADMIN_PASSPHRASE — it is the only key to the /guest-summary payload, and an index ' +
        'built without it would publish the roster under no secret at all.',
    )
  }
  return passphrase
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf-8'))
  const catalogEvents = catalog.events
  const guests = await loadRoster(args.fixture)
  // Checked in and load-bearing: a missing file must fail the sync, or the
  // whole trip personalization would silently fall out of the index.
  const keralaResponses = JSON.parse(
    await readFile(args.kerala ? resolve(root, args.kerala) : KERALA_RESPONSES_PATH, 'utf-8'),
  ).responses

  const adminPassphrase = adminPassphraseFor(args.fixture)

  const knownTags = new Set(guests.flatMap((guest) => [...guest.tags]))
  assertGatesExist(catalogEvents, knownTags)
  assertAdminTagExists(knownTags)
  assertSummaryTagsExist(knownTags)
  assertGolkondaColumnsExist(guests)
  assertGolkondaAnswersRecognized(guests)
  assertSummaryRsvpColumnsExist(guests)
  assertUniversalEventsMatch(catalogEvents, await readFile(BUNDLED_PATH, 'utf-8'))

  const previous = await readPreviousIndex()
  const sourceHash = await sourceFingerprint(
    guests,
    catalogEvents,
    keralaResponses,
    adminPassphrase,
  )

  if (!args.force && !args.dryRun && previous?.sourceHash === sourceHash) {
    console.log('Roster and catalog unchanged since the last index — nothing to publish.')
    return
  }

  const { index, stats } = await buildIndex({
    guests,
    catalogEvents,
    adminPassphrase,
    sourceHash,
    keralaResponses,
  })

  if (!args.force) {
    // `previous.guestCount`, never Object.keys(previous.guests) — that object
    // is keyed per alias and counting it compares guests against lookup keys.
    // An index published before v4 has no count, and skips the ratio check
    // until the first run under this version republishes one.
    const previousCount = args.fixture ? 0 : (previous?.guestCount ?? 0)
    assertRosterPlausible(stats.guests, previousCount)
    // Not on the fixture, which carries a deliberately tagless row to exercise
    // that path. The warning below still reports it.
    if (!args.fixture) assertEveryGuestResolves(stats.unresolvedRows)
  }

  // Counts only — never names.
  console.log(`Guests resolved:  ${stats.guests}`)
  console.log(`Lookup keys:      ${stats.lookupKeys} (aliases + collisions)`)
  console.log(`Admins:           ${stats.admins}`)
  console.log(`Kerala responses: ${stats.keralaResponses} (all matched)`)
  console.log(
    `Golkonda rooms:   ${stats.golkondaCovered} covered, ${stats.golkondaOwn} own ` +
      `(tagged, attending, and taking the room)`,
  )
  console.log(
    `Guest summary:    ${stats.summary} names — ` +
      `${stats.summaryStatus.attending} attending, ${stats.summaryStatus.declined} not, ` +
      `${stats.summaryStatus.none} no response`,
  )
  console.log(
    `  by side:        ` +
      Object.entries(stats.summaryTagged)
        .map(([tag, count]) => `${count} ${tag}`)
        .join(', '),
  )
  if (stats.unresolvedRows.length > 0) {
    console.warn(
      `\nWarning: ${stats.unresolvedRows.length} guest(s) carry no gating tag and are absent ` +
        `from the index (sheet row(s) ${stats.unresolvedRows.join(', ')}) — they will be told ` +
        `we can't find them. Check their tags in With Joy.\n`,
    )
  }
  console.log('Invited per event:')
  for (const [id, count] of Object.entries(stats.perEvent)) {
    console.log(`  ${id.padEnd(20)} ${count}`)
  }

  if (args.dryRun) {
    console.log('\n--dry-run: nothing written.')
    return
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(index)}\n`)
  const bytes = (await readFile(OUTPUT_PATH)).length
  console.log(`\nWrote public/schedule-index.json (${(bytes / 1024).toFixed(1)} KB)`)
}

main().catch((error) => {
  console.error(`\nbuild-schedule-index failed: ${error.message}`)

  // fetch() surfaces every transport problem as a bare 'fetch failed' — the
  // actionable detail (DNS, TLS, refused connection, proxy) only lives on the
  // cause chain, so walk it rather than swallowing it.
  const codes = []
  for (let cause = error.cause; cause; cause = cause.cause) {
    codes.push(cause.code)
    console.error(`  caused by: ${cause.code ? `[${cause.code}] ` : ''}${cause.message}`)
  }

  if (error.message === 'fetch failed') {
    console.error(
      '\nThat is a network failure, not a credentials problem — the request never reached\n' +
        'Google. Check connectivity to oauth2.googleapis.com and sheets.googleapis.com, and\n' +
        'whether a VPN or proxy is in the way.',
    )
    if (codes.includes('ENOTFOUND') || codes.includes('EAI_AGAIN')) {
      console.error('DNS could not resolve the host.')
    }
    if (codes.some((code) => code?.startsWith?.('ERR_TLS') || code === 'CERT_HAS_EXPIRED')) {
      console.error('TLS negotiation failed, which usually means an intercepting proxy.')
    }
  }

  process.exit(1)
})
