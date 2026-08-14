/**
 * Reads a JPEG's pixel dimensions by walking its segment headers.
 *
 * Shared by build-invite-pdfs.js, which has to size each PDF page before adding
 * its image, and by tests/ogManifest.test.js, which checks the og:image:width
 * and og:image:height that prerender.js declares against the files on disk.
 * Both need the size of a file sips just wrote, without pulling in an image
 * library — scanning for the frame header is cheap and fails loudly on a file
 * that isn't the JPEG it claims to be.
 */

// Start-of-frame markers carry the dimensions. C4/C8/CC sit in the same range
// but are Huffman/arithmetic tables, not frames.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

export function jpegSize(buffer, path) {
  if (buffer.readUInt16BE(0) !== 0xffd8) throw new Error(`${path} is not a JPEG.`)

  let offset = 2
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) throw new Error(`${path}: expected a marker at byte ${offset}.`)

    const marker = buffer[offset + 1]
    // Padding between segments is legal and encoded as repeated 0xFF.
    if (marker === 0xff) {
      offset += 1
      continue
    }

    const length = buffer.readUInt16BE(offset + 2)
    if (SOF_MARKERS.has(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }

  throw new Error(`${path}: no start-of-frame marker, so its size is unknown.`)
}
