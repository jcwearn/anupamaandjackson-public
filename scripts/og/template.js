/**
 * Renders one OG image's HTML from a manifest entry.
 *
 * The ornaments — double hairline, four quarter-mandala corners, and the
 * divider — are the same paths as src/components/OrnamentalFrame.tsx. They're
 * duplicated here rather than imported because this runs under plain node after
 * the build and can't reach into src/; keep the two in sync by hand.
 *
 * Colors are the tailwind.config.ts palette hard-coded for the same reason:
 * peach #ffcadb, cream #fff4f8, gold #c8a25e, buccaneer #69313e, rosewood
 * #8e5164, zeus #29241f. The canvas is peach at 20% over cream, matching the
 * bg-peach/20 the landing page uses.
 */

const WIDTH = 1200
const HEIGHT = 630

// The couple line is fixed copy, and it is the same on every page — only the
// date beneath it moves. Rendered in Playfair with a gold ampersand, the way
// the first /evisa image set it.
const NAMES = ['Anupama', 'Jackson']

// Type scale per variant. These are sized for a link preview on a phone, where
// the whole 1200px canvas lands in something like 300px of screen — at that
// scale a 60px title is about 15px of actual type. `centered` has the full
// canvas and runs at the size the first /evisa image used; the two photo
// variants give width or height back to the panel and step down from there.
const SCALE = {
  centered: { title: 88, names: 48, date: 27, eyebrow: 21, rule: 440 },
  split: { title: 70, names: 39, date: 23, eyebrow: 19, rule: 320 },
  landscape: { title: 68, names: 37, date: 22, eyebrow: 19, rule: 320 },
}

// Playfair at 600 rather than 400. The regular weight thins out badly once a
// preview is scaled down to phone width, which is where these are actually read.
const TITLE_WEIGHT = 600

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Photos are inlined rather than linked because the HTML is rendered from a
 * temp directory, where any relative path into src/assets/ would 404.
 */
export function dataUri(buffer, path) {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  const mime = MIME[extension]
  if (!mime) throw new Error(`${path}: no known MIME type for "${extension}".`)
  return `data:${mime};base64,${buffer.toString('base64')}`
}

const CORNER_ORNAMENT = `
        <g id="corner-ornament">
          <path d="M0 28 A28 28 0 0 0 28 0" fill="none" stroke="#c8a25e" stroke-width="2" />
          <path d="M0 46 A46 46 0 0 0 46 0" fill="none" stroke="#c8a25e" stroke-width="1.3" opacity="0.7" />
          ${[15, 30, 45, 60, 75]
            .map(
              (angle) =>
                `<path d="M31 0 C33.5 -3.4 40.5 -3.4 43 0 C40.5 3.4 33.5 3.4 31 0 Z" transform="rotate(${angle})" fill="#c8a25e" fill-opacity="0.22" stroke="#c8a25e" stroke-width="1.2" />`,
            )
            .join('\n          ')}
          <path d="M7 7 C19 2 26 9 23 17 C20.5 24 11 24 9 16.5 C8 12 9 9.5 7 7 Z" fill="#ffcadb" fill-opacity="0.6" stroke="#c8a25e" stroke-width="1.6" />
          <circle cx="15.5" cy="14" r="1.5" fill="#69313e" />
          <circle cx="47.58" cy="19.71" r="1.8" fill="#c8a25e" />
          <circle cx="36.42" cy="36.42" r="1.8" fill="#69313e" />
          <circle cx="19.71" cy="47.58" r="1.8" fill="#c8a25e" />
        </g>`

// A plain gold rule broken by a diamond — the divider the first /evisa image
// used. The MandalaDivider from OrnamentalFrame.tsx is busier than this needs
// to be at the size the text sits at, and it competes with the corner mandalas.
const DIAMOND_RULE = `
      <svg viewBox="0 0 320 14" class="divider" preserveAspectRatio="xMidYMid meet">
        <line x1="0" y1="7" x2="136" y2="7" stroke="#c8a25e" stroke-width="2.2" />
        <line x1="184" y1="7" x2="320" y2="7" stroke="#c8a25e" stroke-width="2.2" />
        <path d="M160 1 L166 7 L160 13 L154 7 Z" fill="#c8a25e" />
      </svg>`

/** Three covers to a board, standing on as many boards as that fills. */
const COVERS_PER_BAY = 3

function renderShelf(covers) {
  const bays = []
  for (let index = 0; index < covers.length; index += COVERS_PER_BAY) {
    const row = covers
      .slice(index, index + COVERS_PER_BAY)
      .map((uri) => `<img src="${uri}" alt="" />`)
      .join('')
    bays.push(`<div class="bay-row">${row}</div><div class="board"></div>`)
  }
  return `<div class="shelf">${bays.join('')}</div>`
}

/**
 * @param entry a manifest record
 * @param assets `{ photo, covers }` — data URIs, already read off disk
 */
export function renderOgHtml(entry, assets = {}) {
  const variant = entry.variant ?? 'split'
  const centered = variant === 'centered'
  const landscape = variant === 'landscape'
  const scale = SCALE[variant]
  if (!scale) throw new Error(`${entry.slug}: unknown variant "${variant}".`)
  const titleSize = entry.titleSize ?? scale.title

  // Home's title already says the names, so it skips the couple line.
  const names =
    entry.showNames === false
      ? ''
      : `<div class="names">${escapeHtml(NAMES[0])}<span class="amp">&amp;</span>${escapeHtml(
          NAMES[1],
        )}</div>`

  const panel = centered
    ? ''
    : `
      <div class="panel">
        ${assets.covers ? renderShelf(assets.covers) : `<img class="photo" src="${assets.photo}" alt="" />`}
      </div>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        position: relative;
        background: #ffecf2;
        display: flex;
        align-items: center;
        ${
          landscape
            ? /* Text over a wide panel, so a landscape photo keeps its full
                 width and gives up height instead of the other way round. */
              `flex-direction: column;
        justify-content: center;
        gap: 20px;
        padding: 36px 56px 38px;`
            : `gap: 44px;
        padding: 0 56px;`
        }
      }
      .hairline-outer, .hairline-inner {
        position: absolute;
        border-radius: 2px;
        pointer-events: none;
      }
      .hairline-outer { inset: 16px; border: 2px solid rgba(200, 162, 94, 0.55); }
      .hairline-inner { inset: 23px; border: 1.5px solid rgba(200, 162, 94, 0.8); }
      .corner { position: absolute; width: 96px; height: 96px; }
      .corner-tl { top: 22px; left: 22px; }
      .corner-tr { top: 22px; right: 22px; transform: rotate(90deg); }
      .corner-br { bottom: 22px; right: 22px; transform: rotate(180deg); }
      .corner-bl { bottom: 22px; left: 22px; transform: rotate(-90deg); }

      /* Centered, not flush left: the text is a plate of its own, and ragged
         left type beside a symmetrical arch reads as a mistake. */
      .content {
        flex: 1;
        min-width: 0;
        text-align: center;
      }
      .eyebrow {
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        font-size: ${scale.eyebrow}px;
        letter-spacing: 0.25em;
        /* The tracking is all trailing, so the block sits left of true center
           without pulling the last letter's space back off. */
        text-indent: 0.25em;
        text-transform: uppercase;
        color: #8a7565;
        margin-bottom: 22px;
      }
      .title {
        font-family: 'Playfair Display', serif;
        font-weight: ${TITLE_WEIGHT};
        font-size: ${titleSize}px;
        line-height: 1.08;
        letter-spacing: -0.02em;
        color: #69313e;
      }
      .divider {
        display: block;
        width: ${scale.rule}px;
        height: 16px;
        margin: ${landscape ? '18px' : '24px'} auto;
      }
      .names {
        font-family: 'Playfair Display', serif;
        font-weight: 500;
        font-size: ${scale.names}px;
        line-height: 1.1;
        color: #29241f;
      }
      .amp {
        color: #c8a25e;
        font-style: italic;
        padding: 0 0.34em;
      }
      .date {
        margin-top: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: ${scale.date}px;
        color: rgba(41, 36, 31, 0.78);
      }

      /* Two panel shapes for two kinds of photograph. The portrait arch suits a
         centered vertical subject; the landscape one is the same arch flattened
         out, keeping a wide photo's full width and taking the crop out of its
         height instead — which is where a backwater or a facade has room to
         spare. */
      .panel {
        flex: none;
        padding: 10px;
        background: rgba(255, 255, 255, 0.7);
        border: 2px solid rgba(200, 162, 94, 0.7);
        ${
          landscape
            ? `width: 900px;
        height: 290px;
        border-radius: 150px 150px 14px 14px;`
            : `width: 340px;
        height: 470px;
        border-radius: 170px 170px 16px 16px;`
        }
      }
      .panel .photo {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: ${entry.photoPosition ?? 'center'};
        border-radius: ${landscape ? '140px 140px 8px 8px' : '160px 160px 10px 10px'};
      }
      /* A cabinet of covers standing face-out on two boards, so the panel reads
         as the page's own shelf rather than a pile of thumbnails. Wood tones
         are lifted from Shelf3D.tsx; the arch above the top bay is the
         cabinet's own head, which is why the rows sit low. */
      .shelf {
        height: 100%;
        border-radius: 160px 160px 10px 10px;
        overflow: hidden;
        background:
          repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 34px, rgba(0,0,0,0.08) 37px),
          linear-gradient(180deg, #55422d 0%, #483824 55%, #3d2f1e 100%);
        box-shadow: inset 0 6px 18px rgba(20, 12, 5, 0.55);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 12px;
        padding: 0 14px 14px;
      }
      .bay-row {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 8px;
      }
      .bay-row img {
        width: 92px;
        height: 138px;
        object-fit: cover;
        border-radius: 1px;
        box-shadow: 0 6px 10px -4px rgba(12, 7, 2, 0.7);
      }
      /* The board's top surface recedes from a lit front arris into shade. */
      .board {
        height: 12px;
        border-radius: 1px;
        background: linear-gradient(180deg, #ac8753 0%, #8f6d42 45%, #6f5533 100%);
        box-shadow:
          inset 0 1px 0 rgba(255, 235, 200, 0.35),
          0 10px 14px -4px rgba(20, 12, 5, 0.6);
      }
    </style>
  </head>
  <body>
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <defs>${CORNER_ORNAMENT}
      </defs>
    </svg>

    <div class="hairline-outer"></div>
    <div class="hairline-inner"></div>
    <svg viewBox="0 0 100 100" class="corner corner-tl"><use href="#corner-ornament" /></svg>
    <svg viewBox="0 0 100 100" class="corner corner-tr"><use href="#corner-ornament" /></svg>
    <svg viewBox="0 0 100 100" class="corner corner-br"><use href="#corner-ornament" /></svg>
    <svg viewBox="0 0 100 100" class="corner corner-bl"><use href="#corner-ornament" /></svg>

    <div class="content">
      ${entry.eyebrow ? `<div class="eyebrow">${escapeHtml(entry.eyebrow)}</div>` : ''}
      <div class="title">${escapeHtml(entry.title)}</div>${DIAMOND_RULE}
      ${names}
      <div class="date">${escapeHtml(entry.date)}</div>
    </div>${panel}
  </body>
</html>
`
}

export { WIDTH, HEIGHT }
