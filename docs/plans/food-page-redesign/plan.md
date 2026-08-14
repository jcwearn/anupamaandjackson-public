# Plan: Photo-forward redesign of the What to Eat page

## Context

`/travel/food` has strong content — 14 dish cards across three sections, 8 place cards, a veg/vegan
callout — but it is the only long content page on the site with no photography and none of the
site's visual devices (arch, ornamental frame, photo mat, icons). It reads as a wall of text blocks.

Decisions made with Jackson:

- **Photo-forward**: hero imagery plus a photo on each dish card and place card (~23 images).
- **Photos sourced from Wikimedia Commons** (CC0 / PD / CC BY / CC BY-SA only) into
  `src/assets/food/`, with attribution in a photo-credits disclosure at the page foot.
- **No interactive nav** — better structure and varied layout rhythm only.
- **Reorganize freely** — sections may be reordered; light copy edits OK (made in `eats.ts`).
- **Stacked PR**: branch `feat/food-page-photos` off `feat/eat-like-a-local`, PR targeting
  `feat/eat-like-a-local` so PR #230 stays reviewable as the text version.

## Phases

### Phase 1: Source & process images
- Query the Commons API (`generator=search` / `list=categorymembers`) with
  `prop=imageinfo&iiprop=url|extmetadata` to get license + author up front.
- Accept only CC0 / PD / CC BY / CC BY-SA; prefer CC0/PD for the hero (it becomes the OG image).
- Download 1600px thumbs to the scratchpad; log provenance per image in `progress.md`
  (Commons file page URL, author, license, transform applied).
- Process into `src/assets/food/<slug>.jpg` (+ `.webp` via `cwebp -q 78`); grid-only cards can be
  1000px. Record final pixel dimensions for the data fields.
- Files involved: `src/assets/food/*` (new)
- Acceptance criteria: every dish, every place (with agreed fallbacks), and the hero have a
  processed jpg+webp pair ≤ ~150 KB webp, with provenance logged.

### Phase 2: Data model, components, tests
- `eats.ts`: `PhotoCredit` + `FoodPhoto` interfaces; `Dish`/`EatPlace` gain `photo?`; export
  `heroPhoto`; ES-import all assets.
- New `src/components/PhotoFrame.tsx` (gold-mat `<picture>` primitive, aspect + arch variants).
- `DishCard.tsx`: optional photo + `layout: 'stack' | 'feature'` (+ `reverse`).
- `EatPlaceCard.tsx`: side photo, `reverse` prop.
- Photo-credits disclosure (id `photo-credits`) collecting every `photo.credit`.
- Extend `Food.test.tsx` (credit URLs join the external-link count; photos have alt +
  width/height; credits render one entry per credited photo) and card tests.
- Acceptance criteria: `npm test` green under Node 24.

### Phase 3: Page layout
- Header triptych of arched photos (or single wide hero — judged against the real photos).
- Telugu table: banti bhojanam full-width feature, mirrored feature closing.
- Muslim table: biryani feature, paired stacks, irani-chai photo-right feature.
- New MandalaDivider before Further south; arch-top photos in that section.
- Where to go: alternating photo-left/photo-right place cards.
- Credits disclosure after the closing note.
- Acceptance criteria: tests green; visual pass in Chrome + Firefox at desktop and 375px.

### Phase 4: OG image + polish
- `public/og-food.jpg` (1200×630) cropped from the hero source; point
  `scripts/prerender.js` `/travel/food` at it.
- Polish: copy-link hovers inside feature layouts, anchor offsets, page weight.
- Acceptance criteria: full suite + build green; PR opened against `feat/eat-like-a-local`.
