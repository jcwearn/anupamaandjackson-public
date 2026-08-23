import React from 'react'
import { restingDeg } from '../lib/motion'
import type { ShelfItem } from '../data/shelf'

// Same guard PlaceCarousel keeps locally; redeclared rather than lifted so this
// feature doesn't touch that file.

/** How long the spotlight takes to come up over a hovered item. */
const LEAN_MS = 300

/** Face-out film case size — uniform, the way real cases are. */
export const CASE_WIDTH_PX = 138
export const CASE_HEIGHT_PX = 207
export const CASE_DEPTH_PX = 18

/** Books three to a shelf, films four — books run larger and vary in height. */
const BOOKS_PER_ROW = 3
const CASES_PER_ROW = 4

/** Row geometry the responsive layout has to reason about. */
const ROW_GAP_PX = 24 // gap-6 between boxes
const ROW_PAD_PX = 64 // px-8 inside each bay
/** Page padding + the wrapper's px-4 + the frame's rails, in px. */
const CASE_CHROME_PX = 52
/** The page column the case lives in (max-w-3xl). */
const PAGE_MAX_PX = 768
/** Never shrink boxes past this — covers a 320px screen at two across. */
const MIN_SCALE = 0.7

// The woods. Warm browns built off soyabean/zeus rather than flat palette
// fills: a frame lit from above, a darker back panel with faint vertical
// grain, and shelf boards whose top edge catches the light.
const FRAME_WOOD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #8a7154 0%, #6f5638 30%, #5a452c 70%, #4a3823 100%)',
}
const BACK_PANEL: React.CSSProperties = {
  background:
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 34px, rgba(0,0,0,0.08) 37px), ' +
    'linear-gradient(180deg, #55422d 0%, #483824 55%, #3d2f1e 100%)',
  boxShadow: 'inset 0 6px 18px rgba(20, 12, 5, 0.55), inset 0 -4px 10px rgba(20, 12, 5, 0.35)',
}
// A shelf board in two visible faces. The top surface recedes from a lit
// front edge into the cabinet's shade, with faint grain running along the
// board; the books stand at its back edge, so their contact shadows fall
// forward across it. The lip is the board's front edge: end grain in shadow
// under a bright arris line, casting down onto the bay below.
const SHELF_SURFACE: React.CSSProperties = {
  background:
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 44px, rgba(0,0,0,0.05) 47px), ' +
    'linear-gradient(180deg, #5d442a 0%, #7d5f3a 26%, #a17c4b 62%, #c29a63 100%)',
  boxShadow: 'inset 0 2px 3px rgba(20, 12, 5, 0.5)',
}
const SHELF_LIP: React.CSSProperties = {
  // Clearly lighter than the shadowed back panel below: this face looks at
  // the room, so it catches the light — that contrast is what makes the
  // board read as having a front edge at all.
  background: 'linear-gradient(180deg, #ac8753 0%, #8f6d42 45%, #6f5533 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255, 235, 200, 0.35), 0 12px 18px -4px rgba(20, 12, 5, 0.65)',
}
// The cabinet's inner cheeks: vertical walls receding to the back panel,
// darkest in the corners where the least light reaches.
const SIDE_WALL = (side: 'left' | 'right'): React.CSSProperties => ({
  width: 18,
  background: `linear-gradient(${side === 'left' ? '90deg' : '270deg'}, rgba(16, 10, 4, 0.62) 0%, rgba(16, 10, 4, 0.30) 45%, rgba(16, 10, 4, 0) 100%)`,
})

// A book's fore-edge: hundreds of paper leaves. Each leaf's edge is a line
// running the height of the face, and the leaves stack through the book's
// depth, so the striping runs across the face, not down it.
const PAGE_SIDE: React.CSSProperties = {
  background:
    'linear-gradient(90deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.02) 35%, rgba(0,0,0,0.16) 100%), ' +
    'repeating-linear-gradient(90deg, #f2e7d3 0px, #f2e7d3 2px, #dbcdb1 2px, #dbcdb1 3px)',
}
// Seen from above, the same leaves run front-to-back instead.
const PAGE_TOP: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.18) 100%), ' +
    'repeating-linear-gradient(180deg, #f6ecd9 0px, #f6ecd9 2px, #e0d2b6 2px, #e0d2b6 3px)',
}
/**
 * How far back across the case's thickness the two halves close. The front
 * cover shuts onto a rim moulded into the back half, so the seam sits behind
 * the midpoint rather than on it.
 */
const SEAM_DEPTH = 0.62

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

/**
 * The seam where the case's two halves meet, as one gradient layer.
 *
 * The side and top faces run their depth axis in opposite directions — the side
 * from front (0%) to back (100%), the top from back (0%) to front (100%) — so
 * each caller resolves SEAM_DEPTH against its own axis. The two faces share a
 * watertight corner, so a seam sitting at different depths on the two visibly
 * breaks at the join.
 *
 * The bands are deliberately coarse: at the shelf's display angles the side
 * face is only 6-8px wide on screen, and a stop pair any tighter than this
 * rounds away to nothing.
 */
const seamLayer = (deg: number, at: number) =>
  `linear-gradient(${deg}deg, rgba(0,0,0,0) ${pct(at - 0.1)}, rgba(0,0,0,0.66) ${pct(at)}, ` +
  `rgba(255,255,255,0.1) ${pct(at + 0.07)}, rgba(0,0,0,0) ${pct(at + 0.16)})`

// A film case's side and top: black moulded plastic, the top a touch lighter
// where the light lands on it. The side is the case's opening edge — the hinge
// is on the left, at the rounded end of the borderRadius below — so it carries
// the seam and the thumb indent you hook a finger into.
const CASE_SIDE: React.CSSProperties = {
  background: [
    // The thumb indent: a channel down the middle of the opening edge rather
    // than a dimple, which is the shape a real case's scoop actually has.
    //
    // Built from its lit edges, not from a dark blob. This plastic is nearly
    // black, so a shadow laid over it has almost nothing left to darken and the
    // scoop simply vanishes — the rim catching the light is the whole effect.
    // Radii in percentages, so it holds from a shrunken shelf box to the
    // pull-out's copy.
    // Sitting at 34% across, in front of the seam: the notch is cut into the
    // front cover's lip, which is the half of the thickness ahead of the joint.
    // Keeping it clear of the seam also stops the two details muddying each
    // other on a face this narrow.
    'radial-gradient(44% 4% at 34% 34%, rgba(255,240,214,0.34) 0%, rgba(255,240,214,0) 78%)',
    'radial-gradient(52% 16% at 34% 47%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 54%, rgba(0,0,0,0) 76%)',
    // The floor of the scoop faces up, so it comes back brighter than the flat
    // plastic on either side of it.
    'radial-gradient(44% 5% at 34% 61%, rgba(255,240,214,0.45) 0%, rgba(255,240,214,0) 78%)',
    seamLayer(90, SEAM_DEPTH),
    // Front-to-back shading: the edge facing the room keeps a little light, the
    // back corner falls away into the cabinet. A broad ramp, not an arris line
    // — at this face's on-screen width a thin highlight would not survive.
    'linear-gradient(90deg, rgba(255,240,214,0.13) 0%, rgba(255,240,214,0) 34%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.42) 100%)',
    // The plastic itself, lit from above. Dark, but deliberately not as dark as
    // it can go: the indent above needs somewhere to cut into.
    'linear-gradient(180deg, #2f281f 0%, #211b15 55%, #191410 100%)',
  ].join(', '),
}
const CASE_TOP: React.CSSProperties = {
  background: [
    seamLayer(180, 1 - SEAM_DEPTH),
    'linear-gradient(180deg, #3d342a 0%, #2a231b 100%)',
  ].join(', '),
}
// The front board's finish, painted over the artwork the way a real case's
// plastic sits over the printed insert. A book gets the shadowed crease of its
// hinge; a case gets the edge where its cover turns to meet the opening face.
//
// No diagonal sheen on the case: a highlight painted into the face is fixed to
// the artwork, so it cannot answer the angle the box is turned at and sat dead
// still while the box animated — and being identical on every case, it read as a
// texture over the whole shelf rather than as light. The case's specular now
// comes only from the geometry: the lit front edge on the opening face, and the
// spotlight wash that arrives on hover.
const BOOK_HINGE_CREASE =
  'linear-gradient(90deg, rgba(0,0,0,0.28) 0%, rgba(255,255,255,0.10) 3.5%, rgba(0,0,0,0.12) 6%, rgba(0,0,0,0) 9%)'
const CASE_FRONT_FINISH =
  'linear-gradient(90deg, rgba(0,0,0,0) 97%, rgba(0,0,0,0.42) 99%, rgba(0,0,0,0.22) 100%)'
// The back boards: a book's cloth-dark rear cover, a case's moulded plastic.
const BOOK_BACK: React.CSSProperties = { background: '#4a3b2f' }
const CASE_BACK: React.CSSProperties = { background: '#221c16' }

// The spotlight is painted once and faded with opacity — never a box-shadow
// transition. Animating box-shadow inside a preserve-3d subtree makes Chrome
// re-raster along layer-tile boundaries, which flashes hairline white seams
// across the shelf as the pointer moves; opacity runs on the compositor and
// leaves none.
const SPOTLIGHT_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(closest-side, rgba(255, 214, 140, 0.65) 0%, rgba(200, 162, 94, 0.38) 52%, rgba(200, 162, 94, 0) 76%)',
}
const SPOTLIGHT_RING = '0 0 0 2px rgba(200, 162, 94, 0.9)'

// The display angle, with a little per-position variance so the row still
// looks placed by hand. Derived from index, not chance, so server and client
// agree. Exported so the pull-out can park its copy at the same angle the
// shelf box rests at — a fixed departure angle visibly snaps the page block
// wider or narrower on the first frame.

// Each item carries its own close-up camera: perspective() inside the item's
// transform gives every box a genuine vanishing point, so the front face
// foreshortens into a trapezoid and the side and top recede — a distant
// bay-level perspective left the covers looking like flat images with a strip
// pasted behind. The slight rotateX reads as viewing the shelf from just
// above, which is what keeps the top faces visible.
const boxTransform = (deg: number) => `perspective(900px) rotateX(-5deg) rotateY(${deg}deg)`

/**
 * The six faces' worth of a book or film case that matter from a shelf: a
 * front board carrying the cover at +depth/2, a back board at -depth/2, and
 * the block between them — paper leaves for a book, moulded plastic for a
 * case. The side and top planes run the box's full height and width so their
 * shared corner is watertight. Shared by the shelf and the pull-out overlay,
 * so the object that travels is the object that sat there.
 *
 * All lighting lives on the front board's plane (+depth/2), never on the
 * containing box: a shadow or ring drawn at the box's own z=0 lands mid-block
 * and visibly slices the pages in half.
 */
export const PrismFaces: React.FC<{
  item: ShelfItem
  depth: number
  lit?: boolean
  /**
   * For the pull-out's copy: decode the cover synchronously and skip the alt
   * text. A fresh img element paints before its async decode finishes, so the
   * first-ever pull flashed one frame of alt text where the cover should be —
   * and inside the overlay the dialog already names the item.
   */
  hero?: boolean
}> = ({ item, depth, lit = false, hero = false }) => {
  const isBook = item.spine !== undefined
  const half = depth / 2
  // Hinge on the left for books (the spine side), so corners round like
  // boards do: tight at the hinge, a touch more at the fore-edge.
  const radius = isBook ? '2px 3px 3px 2px' : '5px 2px 2px 5px'

  return (
    <>
      {/* The back board. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          transform: `translateZ(${-half}px)`,
          borderRadius: radius,
          ...(isBook ? BOOK_BACK : CASE_BACK),
        }}
      />
      {/* The block's fore-edge, spanning back board to front board. */}
      <span
        aria-hidden
        className="absolute top-0 left-full block h-full"
        style={{
          width: depth,
          transformOrigin: 'left center',
          transform: `translateZ(${half}px) rotateY(90deg)`,
          ...(isBook ? PAGE_SIDE : CASE_SIDE),
        }}
      />
      {/* The block's top, seen from just above the shelf. */}
      <span
        aria-hidden
        className="absolute bottom-full left-0 block w-full"
        style={{
          height: depth,
          transformOrigin: 'center bottom',
          transform: `translateZ(${half}px) rotateX(90deg)`,
          ...(isBook ? PAGE_TOP : CASE_TOP),
        }}
      />
      {/* The front board, carrying the cover and all of the lighting. */}
      <span
        className="absolute inset-0 block"
        style={{
          transform: `translateZ(${half}px)`,
          borderRadius: radius,
        }}
      >
        {/* The spotlight's halo, painted behind the cover and faded in. */}
        <span
          aria-hidden
          className="absolute -inset-7"
          style={{
            ...SPOTLIGHT_GLOW,
            opacity: lit ? 1 : 0,
            transition: `opacity ${LEAN_MS}ms ease`,
          }}
        />
        <picture>
          <source type="image/webp" srcSet={item.cover.webp} />
          <img
            src={item.cover.src}
            alt={hero ? '' : item.cover.alt}
            width={item.cover.width}
            height={item.cover.height}
            loading={hero ? 'eager' : 'lazy'}
            decoding={hero ? 'sync' : 'async'}
            className="h-full w-full object-cover ring-1 ring-zeus/40"
            style={{ borderRadius: radius }}
          />
        </picture>
        {/* Front-face finish: the shadowed crease of a hinge for books, the
            clips and sheen of a plastic case for films. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background: isBook ? BOOK_HINGE_CREASE : CASE_FRONT_FINISH,
          }}
        />
        {/* The spotlight's wash of light down the cover. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            background:
              'radial-gradient(120% 85% at 50% 12%, rgba(255, 244, 216, 0.34) 0%, rgba(255, 244, 216, 0.10) 45%, rgba(255, 244, 216, 0) 70%)',
            opacity: lit ? 1 : 0,
            transition: `opacity ${LEAN_MS}ms ease`,
          }}
        />
        {/* And its gold rim — a constant shadow, only the opacity moves. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: radius,
            boxShadow: SPOTLIGHT_RING,
            opacity: lit ? 1 : 0,
            transition: `opacity ${LEAN_MS}ms ease`,
          }}
        />
      </span>
    </>
  )
}

/**
 * One item on the shelf. Hover or focus doesn't move it; it puts it under a
 * spotlight — React state driving inline styles rather than a CSS :hover
 * rule, so tests can assert on it. Each box grounds itself with a contact
 * shadow lying flat on the board beneath it.
 */
/** A box's display width on the shelf, before any responsive shrink. */
const itemWidth = (item: ShelfItem) =>
  item.spine
    ? Math.round((item.spine.heightPx * item.cover.width) / item.cover.height)
    : CASE_WIDTH_PX

const BoxButton: React.FC<{
  item: ShelfItem
  index: number
  pulled: boolean
  /** Responsive shrink factor — 1 on any screen wide enough for full size. */
  scale: number
  onSelect: (item: ShelfItem, trigger: HTMLButtonElement) => void
}> = ({ item, index, pulled, scale, onSelect }) => {
  const [lit, setLit] = React.useState(false)
  const isBook = item.spine !== undefined

  // The overlay taking the item also takes its spotlight: the pointer's
  // leave event never fires once the button is hidden, so without this the
  // stale glow survives the pull-out and relights alongside the next hover.
  React.useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (pulled) setLit(false)
  }, [pulled])

  // Books keep their real proportions: display height from the data (novels
  // are not all the same size), width from the cover's aspect ratio, and
  // depth from the spine — A Suitable Boy is genuinely that thick. The
  // responsive scale multiplies the layout sizes themselves (never a CSS
  // transform), so the pull-out's rect measurements stay honest.
  const height = Math.round((isBook ? item.spine!.heightPx : CASE_HEIGHT_PX) * scale)
  const width = Math.round(itemWidth(item) * scale)
  const depth = Math.round((isBook ? item.spine!.widthPx : CASE_DEPTH_PX) * scale)

  return (
    <button
      type="button"
      onClick={(e) => onSelect(item, e.currentTarget)}
      onPointerEnter={() => setLit(true)}
      onPointerLeave={() => setLit(false)}
      // :focus-visible, not focus: closing the pull-out hands focus back to
      // this button, and a mouse user's returned focus must not leave it
      // glowing under a hover that has moved elsewhere. Keyboard focus still
      // lights it. (The try is for engines whose selector set lacks it.)
      onFocus={(e) => {
        try {
          setLit(e.currentTarget.matches(':focus-visible'))
        } catch {
          setLit(true)
        }
      }}
      onBlur={() => setLit(false)}
      aria-label={`${item.title} — ${isBook ? 'pull it off the shelf' : 'take it off the shelf'}`}
      className="relative shrink-0 cursor-pointer"
      style={{
        width,
        height,
        transformStyle: 'preserve-3d',
        transform: boxTransform(restingDeg(index)),
        // While the pull-out overlay holds this item, its slot stays empty —
        // hidden, not unmounted, so the row doesn't close the gap.
        visibility: pulled ? 'hidden' : undefined,
      }}
    >
      {/* The contact shadow: a dark pool lying flat on the board under the
          box, spilling a little past it on every side. This, not a drop
          shadow, is what makes the box read as standing on the shelf. */}
      <span
        aria-hidden
        className="absolute top-full"
        style={{
          left: -8,
          right: -12,
          height: depth + 14,
          transformOrigin: 'center top',
          transform: `translateZ(${depth / 2 + 4}px) rotateX(-90deg)`,
          background:
            'radial-gradient(50% 55% at 48% 35%, rgba(20, 12, 5, 0.5) 0%, rgba(20, 12, 5, 0.25) 55%, rgba(20, 12, 5, 0) 78%)',
        }}
      />
      <PrismFaces item={item} depth={depth} lit={lit} />
    </button>
  )
}

const chunk = <T,>(list: T[], size: number): T[][] => {
  const rows: T[][] = []
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size))
  return rows
}

/**
 * A wooden bookcase holding the items face out, like the display wall of a
 * bookshop or video store: two bays of three books, or two bays of four film
 * cases. The frame, back panel, and shelf boards are all CSS-drawn wood in
 * warm browns off the site palette. Each bay scrolls sideways on narrow
 * screens, so the board lives inside the scroller and spans however wide the
 * row runs.
 */
const Shelf3D: React.FC<{
  items: ShelfItem[]
  variant: 'spine' | 'case'
  /** Slug of the item currently held by the pull-out overlay, if any. */
  pulledSlug: string | null
  onSelect: (item: ShelfItem, trigger: HTMLButtonElement) => void
}> = ({ items, variant, pulledSlug, onSelect }) => {
  // The width the case interior actually has. null until the client measures
  // — the server renders the desktop layout, and the pre-paint effect below
  // corrects it before a narrow screen ever sees a frame.
  const [avail, setAvail] = React.useState<number | null>(null)
  React.useLayoutEffect(() => {
    const measure = () => setAvail(Math.min(window.innerWidth, PAGE_MAX_PX) - CASE_CHROME_PX)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // The widest row a given chunking produces, at full size.
  const widthFor = (n: number) =>
    Math.max(
      ...chunk(items, n).map(
        (row) =>
          row.reduce((sum, item) => sum + itemWidth(item), 0) + ROW_GAP_PX * (row.length - 1),
      ),
    ) + ROW_PAD_PX

  // Narrow screens trade columns for rows (3×2 becomes 2×3) rather than
  // scrolling sideways; if even two across cannot fit, the boxes themselves
  // shrink to close the difference.
  let perRow = variant === 'spine' ? BOOKS_PER_ROW : CASES_PER_ROW
  let scale = 1
  if (avail !== null) {
    while (perRow > 2 && widthFor(perRow) > avail) perRow--
    if (widthFor(perRow) > avail) {
      // Only the boxes shrink — gaps and padding hold — so solve for the box
      // scale against each row's fixed chrome and take the tightest.
      const fit = Math.min(
        ...chunk(items, perRow).map((row) => {
          const chrome = ROW_GAP_PX * (row.length - 1) + ROW_PAD_PX
          const sum = row.reduce((total, item) => total + itemWidth(item), 0)
          return (avail - chrome) / sum
        }),
      )
      scale = Math.max(MIN_SCALE, Math.min(1, fit))
    }
  }
  const rows = chunk(items, perRow)

  return (
    <div className="w-full px-4 sm:mx-auto sm:w-fit">
      {/* The frame: its padding is the case's wooden rails and stiles. */}
      <div
        className="rounded-xl p-2.5 shadow-[0_18px_30px_-12px_rgba(41,36,31,0.5)] sm:p-3"
        style={FRAME_WOOD}
      >
        <div className="relative overflow-hidden rounded-lg" style={BACK_PANEL}>
          {/* No bay-level perspective on the rows: each box carries its own
              camera in its transform, which is what keeps every one of them
              reading as a solid object rather than only the row's centre. */}
          {rows.map((row, rowIndex) => (
            // A real scroller only until the client has measured: once the
            // responsive layout guarantees the row fits, clip instead — on
            // iOS any scroll container can be grabbed and rubber-banded
            // vertically, bouncing the whole bay out of its case.
            <div
              key={row[0].slug}
              className={avail === null ? 'overflow-x-auto' : 'overflow-x-clip'}
            >
              {/* min-w-max + mx-auto: centred while the row fits, scrollable
                  once it doesn't — justify-center on the scroller would clip
                  the left end. */}
              <div className="mx-auto min-w-max">
                {/* The negative margin sinks the books' feet into the surface
                    band, so the shelf is behind their whole bottom edge. Each
                    box's display angle lifts its far bottom corner a few
                    pixels — standing deeper on a receding surface — and
                    without the overlap the back panel showed through the gap
                    and the books read as floating. */}
                <div className="-mb-[13px] flex items-end justify-center gap-6 px-8 pt-9">
                  {row.map((item, index) => (
                    <BoxButton
                      key={item.slug}
                      item={item}
                      index={rowIndex * perRow + index}
                      pulled={item.slug === pulledSlug}
                      scale={scale}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
                <div aria-hidden>
                  <div className="h-[20px]" style={SHELF_SURFACE} />
                  <div className="h-[12px] rounded-[1px]" style={SHELF_LIP} />
                </div>
              </div>
            </div>
          ))}
          {/* The inner cheeks sit over everything — boards, books' edges — the
              way a cabinet's sides shade whatever stands close to them. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10"
            style={SIDE_WALL('left')}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10"
            style={SIDE_WALL('right')}
          />
        </div>
      </div>
    </div>
  )
}

export default Shelf3D
