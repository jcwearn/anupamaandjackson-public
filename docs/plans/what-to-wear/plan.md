# Plan: A What to Wear style-guide page

## Context

`working-material/Indian wedding style guide.pptx` — the deck Anupama put together — names 11
outfit types across men's and women's wear and shows a photo of each. The FAQ already answers
"I want to wear Indian clothing — where do I start?" in two paragraphs of prose with no pictures.
This puts the deck on the site as the visual version of that answer.

Jackson asked to keep it out of the top nav. Both nav rows are at their measured width limit
anyway: `useNavItems.test.tsx` caps the top nav at 8 items, and the Travel chip row fills 371 of
374px at 390px.

Decisions made with Jackson:

- **`/what-to-wear`**, standalone under `SiteLayout`, no nav-row changes.
- Scope: the personalized `<GuestDressCodes />` block, then the two galleries, then where to shop.
  **No** "what this is / what this is not" framing slide — the page opens on the guest's own events.
- The deck's photos, used as they are.
- The page is offered **to the FAQ's What to Wear section as a whole**, not from inside one of its
  questions, and the FAQ's own "Where can I shop?" answer stays exactly as it was.

## Phases

### Phase 1: Assets
- 17 photos out of the deck into `src/assets/attire/<slug>.{jpg,webp}`, each pre-cropped to the
  2:3 the cards render at, then resampled to display size, q78 + `cwebp -q 78`.
- Provenance and the two crop exceptions logged in `docs/credits.md`.
- Acceptance: 17 jpg+webp pairs, webp ≤ ~120 KB each.

### Phase 2: Data, route, page
- `src/data/photo.ts` — `SitePhoto`, extracted from `eats.ts`'s `FoodPhoto` so `PhotoFrame` can be
  shared with a second page. `FoodPhoto` becomes an alias; nothing else moves.
- `src/data/attire.ts` — `Outfit { slug, name, note?, photos[] }`, `mensOutfits`, `womensOutfits`.
- `src/routes/WhatToWear.tsx` — `JumpNav` + four sections, 2-up card grid, multi-photo outfits
  spanning the full width.
- `src/components/WhereToShop.tsx` — the shop list, shared with the FAQ so the two can't drift.
- `DisclosureGroup` gains an optional `intro`, for a pointer that belongs to a whole section.
- Registered in all three route tables (`main.tsx`, `entry-server.tsx`, `scripts/prerender.js`)
  plus `scripts/og/manifest.js`.
- Acceptance: `prerenderRoutes.test.tsx` and `ogManifest.test.js` green.

### Phase 3: Tests and verification
- `WhatToWear.test.tsx`: unique URL-safe slugs, every outfit rendered under its own id, alt text
  and intrinsic size on every photo, the 2:3 crop invariant, safe external links, the guest gate.
- `Faq.test.tsx`: the guide is linked once, from the group rather than a question.
- Acceptance: full suite green under Node 24; visual pass in Chrome at 1280/880/375 and Firefox.
