/**
 * Draws a table into a PNG and hands it to the browser as a download.
 *
 * Painted onto a canvas rather than screenshotted off the DOM. The usual way to
 * do that is html2canvas or dom-to-image, and neither is worth a dependency for
 * one table: both work by re-implementing CSS layout anyway, and the thing
 * being exported is four columns of text. The SVG `foreignObject` trick is the
 * other option and is worse here — it needs every font inlined as a data URI or
 * it silently renders in Times.
 *
 * PNG, not JPEG. This is flat colour and small type, which is exactly what JPEG
 * is bad at: it would ring around every glyph, and compress no smaller.
 *
 * The fonts are named rather than loaded. Canvas draws with whatever the
 * document already has, so "Playfair Display" and "Inter" are available here
 * for the same reason they are on the page — and `document.fonts.ready` is
 * awaited first, or an export fired on a cold load draws in the fallback serif.
 */

export interface TableImageColumn {
  header: string
  /** Figures line up right, prose reads from the left. */
  align?: 'left' | 'right'
}

export interface TableImageSpec {
  title: string
  /** Sits under the title in small type — what the figures are, or a caveat. */
  subtitle?: string
  columns: TableImageColumn[]
  rows: string[][]
  /** Drawn under a rule, in the heading colour. */
  footer?: string[]
}

const COLOURS = {
  ink: '#29241f',
  heading: '#8e5164',
  muted: '#69625a',
  rule: '#c8a25e',
  headingRule: '#8e5164',
  paper: '#fffbfc',
}

const PAD = 32
const GAP = 28
const ROW_HEIGHT = 34
const HEADER_HEIGHT = 30

/** Renders the spec and returns the canvas, so tests can measure it. */
export async function drawTableImage(spec: TableImageSpec): Promise<HTMLCanvasElement> {
  await document.fonts?.ready

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser gave no 2D canvas context to draw the export on.')

  const titleFont = '600 22px "Playfair Display", serif'
  const subtitleFont = '13px "Inter", sans-serif'
  const headerFont = '600 11px "Inter", sans-serif'
  const bodyFont = '14px "Inter", sans-serif'
  const footerFont = '600 14px "Inter", sans-serif'

  // Measure first, at scale 1, so the canvas can be sized to its contents
  // rather than the contents clipped to a guessed canvas.
  const widths = spec.columns.map((column, index) => {
    ctx.font = headerFont
    let width = ctx.measureText(column.header.toUpperCase()).width
    for (const row of [...spec.rows, ...(spec.footer ? [spec.footer] : [])]) {
      ctx.font = row === spec.footer ? footerFont : bodyFont
      width = Math.max(width, ctx.measureText(row[index] ?? '').width)
    }
    return Math.ceil(width)
  })

  ctx.font = titleFont
  const titleWidth = ctx.measureText(spec.title).width
  ctx.font = subtitleFont
  const subtitleWidth = spec.subtitle ? ctx.measureText(spec.subtitle).width : 0

  const tableWidth = widths.reduce((sum, width) => sum + width, 0) + GAP * (widths.length - 1)
  const width = Math.ceil(Math.max(tableWidth, titleWidth, subtitleWidth) + PAD * 2)
  const headHeight = 40 + (spec.subtitle ? 22 : 0)
  const height =
    PAD * 2 +
    headHeight +
    HEADER_HEIGHT +
    spec.rows.length * ROW_HEIGHT +
    (spec.footer ? ROW_HEIGHT + 8 : 0)

  // Twice the CSS size, so the text is not soft on the retina screens this is
  // going to be looked at on.
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  ctx.scale(scale, scale)

  ctx.fillStyle = COLOURS.paper
  ctx.fillRect(0, 0, width, height)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLOURS.heading
  ctx.font = titleFont
  ctx.fillText(spec.title, PAD, PAD + 20)

  if (spec.subtitle) {
    ctx.fillStyle = COLOURS.muted
    ctx.font = subtitleFont
    ctx.fillText(spec.subtitle, PAD, PAD + 42)
  }

  // Column x-positions: `left` columns start at their edge, `right` columns end
  // at theirs, which is the same rule the HTML table follows.
  const starts: number[] = []
  let x = PAD
  for (const columnWidth of widths) {
    starts.push(x)
    x += columnWidth + GAP
  }
  const place = (index: number, text: string) => {
    const alignRight = (spec.columns[index].align ?? 'right') === 'right'
    ctx.textAlign = alignRight ? 'right' : 'left'
    ctx.fillText(text, alignRight ? starts[index] + widths[index] : starts[index], 0)
  }

  let y = PAD + headHeight
  ctx.font = headerFont
  ctx.fillStyle = COLOURS.muted
  spec.columns.forEach((column, index) => {
    ctx.save()
    ctx.translate(0, y + 14)
    place(index, column.header.toUpperCase())
    ctx.restore()
  })

  y += HEADER_HEIGHT
  ctx.strokeStyle = COLOURS.headingRule
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(PAD, y - 6)
  ctx.lineTo(width - PAD, y - 6)
  ctx.stroke()

  ctx.font = bodyFont
  for (const row of spec.rows) {
    ctx.fillStyle = COLOURS.ink
    row.forEach((cell, index) => {
      ctx.save()
      ctx.translate(0, y + 22)
      place(index, cell)
      ctx.restore()
    })
    y += ROW_HEIGHT
    ctx.strokeStyle = COLOURS.rule
    ctx.lineWidth = 0.75
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(width - PAD, y)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (spec.footer) {
    y += 8
    ctx.font = footerFont
    ctx.fillStyle = COLOURS.heading
    spec.footer.forEach((cell, index) => {
      ctx.save()
      ctx.translate(0, y + 22)
      place(index, cell)
      ctx.restore()
    })
  }

  return canvas
}

/** Draws the spec and saves it as `<filename>.png`. */
export async function downloadTableImage(spec: TableImageSpec, filename: string): Promise<void> {
  const canvas = await drawTableImage(spec)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not turn the export into a PNG.')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  document.body.append(link)
  link.click()
  link.remove()
  // Not immediately: Safari has not started reading the blob when click()
  // returns, and revoking under it saves a zero-byte file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
