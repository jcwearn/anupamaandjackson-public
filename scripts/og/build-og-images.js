#!/usr/bin/env node
/**
 * Renders every OG image in manifest.js to public/og-*.jpg.
 *
 * Each entry becomes an HTML file in a temp dir, which headless Chrome
 * screenshots at 1200x630 and sips encodes to JPEG — the recipe the old
 * kerala-itinerary-og.html carried in a comment, now applied to every page so
 * the whole set can be re-rendered after a design change.
 *
 * Deliberately not part of `npm run build`: it needs Chrome, sips (macOS) and
 * the network for fonts, none of which belong in CI. The JPEGs are committed,
 * the same way public/invites/ is.
 *
 *   npm run og                 # all of them
 *   npm run og -- --only faq   # just one, while iterating
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { manifest } from './manifest.js'
import { dataUri, renderOgHtml, HEIGHT, WIDTH } from './template.js'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Long enough for the Google Fonts stylesheet and both font files to land.
// Chrome captures as soon as the page settles, so this is a ceiling, not a wait.
const VIRTUAL_TIME_BUDGET = 8000

const JPEG_QUALITY = 80

function parseArgs(argv) {
  const options = { only: null }

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--only') {
      options.only = argv[index + 1]
      index += 1
    } else {
      throw new Error(`Unknown argument "${argv[index]}".`)
    }
  }

  return options
}

async function readAsset(relativePath) {
  const absolute = join(root, relativePath)
  try {
    return dataUri(await readFile(absolute), absolute)
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${relativePath} is missing.`)
    throw error
  }
}

async function buildOne(entry, workDir) {
  const assets = {}
  if (entry.photo) assets.photo = await readAsset(entry.photo)
  if (entry.covers) assets.covers = await Promise.all(entry.covers.map(readAsset))

  const htmlPath = join(workDir, `${entry.slug}.html`)
  const pngPath = join(workDir, `${entry.slug}.png`)
  const outputPath = join(root, 'public', entry.output)

  await writeFile(htmlPath, renderOgHtml(entry, assets))

  await run(CHROME, [
    '--headless=new',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET}`,
    `--screenshot=${pngPath}`,
    `file://${htmlPath}`,
  ])

  await run('sips', [
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(JPEG_QUALITY),
    pngPath,
    '--out', outputPath,
  ])

  console.log(`  -> public/${entry.output}`)
}

async function main() {
  const { only } = parseArgs(process.argv.slice(2))

  const entries = only ? manifest.filter((entry) => entry.slug === only) : manifest
  if (entries.length === 0) {
    const slugs = manifest.map((entry) => entry.slug).join(', ')
    throw new Error(`No manifest entry named "${only}". Known slugs: ${slugs}`)
  }

  const workDir = await mkdtemp(join(tmpdir(), 'og-'))

  try {
    // Serially — Chrome instances fight over the same profile lock otherwise.
    for (const entry of entries) {
      await buildOne(entry, workDir)
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }

  console.log(`Rendered ${entries.length} OG image${entries.length === 1 ? '' : 's'}.`)
}

main().catch((error) => {
  console.error(`build-og-images failed: ${error.message}`)
  process.exit(1)
})
