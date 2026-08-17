import { describe, expect, it, vi, beforeEach } from 'vitest'
import { downloadTableImage, drawTableImage, type TableImageSpec } from './tableImage'

/**
 * jsdom implements no canvas at all — `getContext` returns null and there is no
 * `toBlob` — so both are stubbed here. That makes these tests about the shape of
 * what gets drawn rather than the pixels: which strings are painted, how the
 * canvas is sized, and that the download is wired up. The pixels are checked by
 * looking at the PNG, which no unit test can do for us.
 */
const calls: { text: string; x: number }[] = []
const context = {
  scale: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn((text: string, x: number) => calls.push({ text, x })),
  measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  globalAlpha: 1,
  textAlign: 'left',
  textBaseline: 'alphabetic',
}

const spec: TableImageSpec = {
  title: 'Kerala trip — the total, by rate',
  subtitle: '9 people · ₹4,73,268',
  columns: [{ header: 'Rate', align: 'left' }, { header: 'People' }, { header: 'Total' }],
  rows: [
    ['Full · double occupancy · round trip', '2', '₹1,12,320'],
    ['Price exception · A Guest', '1', '₹67,440'],
  ],
  footer: ['Total', '9', '₹4,73,268'],
}

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as never
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  ) as never
})

describe('drawTableImage', () => {
  it('paints the title, every heading, every cell and the footing', async () => {
    await drawTableImage(spec)
    const painted = calls.map((call) => call.text)

    expect(painted).toContain('Kerala trip — the total, by rate')
    expect(painted).toContain('9 people · ₹4,73,268')
    // Headings are drawn uppercase rather than set uppercase, since canvas has
    // no text-transform.
    expect(painted).toContain('RATE')
    expect(painted).toContain('PEOPLE')
    for (const row of [...spec.rows, spec.footer!]) {
      for (const cell of row) expect(painted).toContain(cell)
    }
  })

  it('sizes the canvas to its contents rather than clipping them to a guess', async () => {
    const canvas = await drawTableImage(spec)
    // The longest cell is 36 characters at the stub's 7px each, and the canvas
    // is drawn at 2x for retina, so it has to be comfortably wider than that.
    expect(canvas.width).toBeGreaterThan(36 * 7 * 2)
    // Two rows, a heading row, a footing and the title block.
    expect(canvas.height).toBeGreaterThan(2 * 34 * 2)
  })

  it('grows the canvas when there are more rows', async () => {
    const short = await drawTableImage({ ...spec, rows: spec.rows.slice(0, 1) })
    const long = await drawTableImage({
      ...spec,
      rows: [...spec.rows, ...spec.rows, ...spec.rows],
    })
    expect(long.height).toBeGreaterThan(short.height)
  })

  it('refuses rather than drawing nothing when the browser has no 2D context', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
    await expect(drawTableImage(spec)).rejects.toThrow(/2D canvas context/)
  })
})

describe('downloadTableImage', () => {
  it('saves a .png, adding the extension when the caller left it off', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn(() => 'blob:stub')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })

    await downloadTableImage(spec, 'kerala-price-breakdown-inr')

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.instances[0] as HTMLAnchorElement
    expect(link.download).toBe('kerala-price-breakdown-inr.png')
    // PNG, not JPEG: this is flat colour and small type, which is what JPEG is
    // worst at — it would ring around every glyph and compress no smaller.
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
    )
  })

  it('leaves the DOM as it found it', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:stub'),
      revokeObjectURL: vi.fn(),
    })

    await downloadTableImage(spec, 'export.png')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
