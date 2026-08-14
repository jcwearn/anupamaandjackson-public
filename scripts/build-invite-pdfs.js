#!/usr/bin/env node
/**
 * Stitches an ordered list of JPEGs into a one-image-per-page PDF.
 *
 * Called by build-invites.sh, which owns the author-only source paths and the
 * sips downscale; this only does the assembly. Uses jspdf, already a dependency
 * for the e-Visa passport export, so the sync stays free of new packages.
 *
 *   node scripts/build-invite-pdfs.js <out.pdf> <page1.jpeg> <page2.jpeg> ...
 */
import { readFile, writeFile } from 'node:fs/promises'
import { jsPDF } from 'jspdf'
import { jpegSize } from './lib/jpegSize.js'

// Width of a page in points. Height follows each image's own aspect so nothing
// is stretched — at the 2271x3250 sources that lands on 597.8pt, matching the
// page size of the PDFs the designer supplied.
const PAGE_WIDTH = 417.75

async function main() {
  const [outputPath, ...inputPaths] = process.argv.slice(2)

  if (!outputPath || inputPaths.length === 0) {
    throw new Error('Usage: build-invite-pdfs.js <out.pdf> <page1.jpeg> ...')
  }

  const pages = await Promise.all(
    inputPaths.map(async (path) => {
      const buffer = await readFile(path)
      const { width, height } = jpegSize(buffer, path)
      return {
        data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
        height: (PAGE_WIDTH * height) / width,
      }
    })
  )

  const doc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, pages[0].height] })

  pages.forEach((page, index) => {
    if (index > 0) doc.addPage([PAGE_WIDTH, page.height])
    // Full bleed: the cards are the page, with the border built into the art.
    doc.addImage(page.data, 'JPEG', 0, 0, PAGE_WIDTH, page.height)
  })

  await writeFile(outputPath, Buffer.from(doc.output('arraybuffer')))
  console.log(`  -> ${outputPath} (${pages.length} pages)`)
}

main().catch((error) => {
  console.error(`build-invite-pdfs failed: ${error.message}`)
  process.exit(1)
})
