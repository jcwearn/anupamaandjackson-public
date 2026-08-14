# Progress: A What to Wear style-guide page

## Current Status: Complete

| Phase | Status | Updated | Notes |
|-------|--------|---------|-------|
| 1. Assets | Complete | 2026-08-09 | 17 jpg+webp pairs in `src/assets/attire/`; provenance in `docs/credits.md` |
| 2. Data, route, page | Complete | 2026-08-09 | `SitePhoto` extracted; `attire.ts`, `WhatToWear.tsx`, `WhereToShop.tsx`; all three route tables + OG |
| 3. Tests and verification | Complete | 2026-08-09 | 572 tests green under Node 24; Chrome 1280/880/375 + Firefox |

## Decisions worth keeping

**The guide is linked once, from the FAQ section rather than a question.** It first went inside
"I want to wear Indian clothing — where do I start?", and Jackson's reaction was that it read as
odd next to "What should I wear?", which has an equal claim on it. It now hangs off the
`what-to-wear` group via `DisclosureGroup`'s `intro` prop, above all four questions.
`Faq.test.tsx` asserts exactly that, so it can't drift back into a single answer.

**`intro` is not part of `blurb`.** `blurb` renders inside the group's `<summary>`, and a link in
there fights the toggle it sits on.

**The FAQ's "Where can I shop?" answer is unchanged**, at Jackson's request, and the page has the
same list. One `WhereToShop` component renders in both rather than two copies of the same three
bullets — the FAQ's own header comment warns against a second copy of the facts, and
`GuestDressCodes` already establishes the pattern.

**On Travel Tips the link sits above `<GuestDressCodes />`.** Below it, an unidentified guest sees
only the unlock prompt, and this half of the answer doesn't need to know who they are.

**Every photo is pre-cropped to 2:3.** The cards are a fixed `aspect-[2/3]` and `object-cover`
silently eats any difference — a source at another ratio loses a head or a hem with nothing to show
for it. A test asserts the invariant so the next photo added can't quietly break it.

**`telugu-dhoti.jpg` stays at 285×427**, the smallest and softest photo on the page. A sharper
1000×1500 stand-in was sourced from a retailer catalogue and Jackson turned it down — it was a
different outfit, and the deck's picture is the look it meant, bordered angavastram and all.
Replace it only with another photo of the same thing.

**`punjabi-dhoti-salwar.jpg` is the one off-centre crop.** Source 550×1060; a centred 2:3 window
cuts the model's head off, so it's anchored 10px from the top and loses the shoes instead.

## Handoff Notes

Nothing outstanding. The page is not in `NAV_ITEMS` and shouldn't be — it's reached from the FAQ's
What to Wear section and Travel Tips' Outfits tip, and `useNavItems.test.tsx` caps the top nav at
8 items regardless.

Firefox's headless `--screenshot` fires before lazy images decode, so anything below the fold comes
out as empty boxes; that verifies layout but not pixels. Use Chrome over CDP for the photos.
