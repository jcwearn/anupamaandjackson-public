# Image credits

Third-party photography in `src/assets/`, and what each licence asks of us.

Most of the site's photographs are our own and need no credit. This file covers
the ones that aren't, so the obligation is written down somewhere other than a
comment next to one use of the file.

| File                                     | Source                                                                                                                                                     | Author                  | Licence                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| `src/assets/travel/indigo-a320neo.jpg`   | [Wikimedia Commons](<https://commons.wikimedia.org/wiki/File:IndiGo_Airbus_A320neo_F-WWDG_(to_VT-ITI)_(28915135713).jpg>) — _IndiGo Airbus A320neo F-WWDG_ | BriYYZ (Brian Bukowski) | **CC BY-SA 2.0**                  |
| `src/assets/travel/india-relief-map.jpg` | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:India_relief_location_map.jpg) — _India relief location map_                                   | Uwe Dedering            | **CC BY-SA 3.0** (also GFDL 1.2+) |
| `src/assets/kerala/houseboat.jpg`        | Wikimedia Commons                                                                                                                                          | RndmCrs                 | CC0                               |
| `src/assets/travel/passport-stamps.jpg`  | `cdn.buttercms.com/KTQVVrU6Q52NyW5ybeq8` — a third-party CMS, not a stock library                                                                          | **unknown**             | **unverified**                    |

Photo provenance for the food page's images is logged separately, in
`docs/plans/food-page-redesign/progress.md`.

## `src/assets/attire/` — the style guide photographs

All seventeen came out of `working-material/Indian wedding style
guide.pptx`, the deck Anupama assembled; they are retailer product photography,
the same class of source as several of the food page's images, and the deck did
not record which shop each came from. There is no file page, no named
photographer and no licence for any of them — the same caveat as
`passport-stamps.jpg` below, and worth the same treatment if the site is ever
put in front of a wider audience than the guest list.

Every file is pre-cropped to 2:3, the ratio the outfit cards render at, then
resampled to display size and encoded at q78 with a `cwebp -q 78` companion. Two
are worth knowing about:

- **`telugu-dhoti.jpg` is 285×427**, the smallest on the page, and soft on a
  retina screen at the ~328px its card renders it. A sharper stand-in from a
  retailer catalogue was offered and turned down: it was a different outfit, and
  this is the look the deck meant, bordered angavastram and all. Swap it only for
  another photo of the same thing.
- **`punjabi-dhoti-salwar.jpg` is the one crop that isn't centred.** Its source is
  550×1060, and a centred 2:3 window cuts the model's head off, so it is anchored
  10px from the top and loses the shoes instead.

## The share-alike ones

The two `src/assets/travel/` files are the only assets here under a
**share-alike** licence, and it is worth knowing what that means before either
gets reused.

Share-alike asks for two things: attribution to the author, and that anything
derived from the work carries the same licence. Each is used in exactly one
place — cropped into an `og:image` for `/travel` and `/travel/tips` — and those
composites are derivative works.

In practice:

- **Leave them where they are** and the obligation is limited. Credit lives
  here, and an OG image is a link preview rather than page content.
- **Put one on the page itself** and it needs a visible credit line next to it,
  the way a photo essay would carry one.
- **Do not** reach for either as a generic travel image elsewhere in the site
  without re-reading the licence — every new use inherits the share-alike term.

If that becomes inconvenient, both can be swapped for CC0 or public-domain
equivalents; nothing about the layout depends on either file.

## The unverified one

`passport-stamps.jpg` came from a ButterCMS asset URL — some other site's
content CDN. That is different in kind from everything else in this table: there
is no file page, no named photographer and no licence, so we cannot say we have
permission to use it. It looks like a stock photograph, which means someone owns
it and the terms are whatever they are.

It is used as the `/evisa` og:image. The risk is small and the fix is cheap:
a search for "passport stamps" on a library with a clear licence — Unsplash,
Pexels, or Commons — turns up near-identical shots that can be dropped in with
one line of the manifest changed. Worth doing before the site is public.

## Derived files

`src/assets/hyderabad/charminar-og.jpg` is `charminar.jpg` with 60px of sky
added above it, generated once with:

```bash
ffmpeg -i src/assets/hyderabad/charminar.jpg \
  -filter_complex "[0:v]crop=iw:8:0:0,scale=1600:60,avgblur=60:6[top];[top][0:v]vstack=inputs=2" \
  -q:v 3 src/assets/hyderabad/charminar-og.jpg
```

The original has almost no headroom over the minaret finials, and the OG panel
is a semicircular arch that clips its top corners exactly where those finials
sit. No crop or `photoPosition` can fix that — the panel already shows the
photo's full height, so there is nothing to pan into. The added strip is the
image's own top row stretched and blurred, which is invisible at the size the
OG image is seen and would not survive being looked at full size. Do not reuse
this file on a page; `charminar.jpg` is the real photograph and `/travel/hyderabad`
still uses it.

## A note on maps

`india-relief-map.jpg` is a physical relief map with no labels and no captions
on the Kashmir boundaries — it draws them and says nothing about them.

That was deliberate. A labelled political map of India is not a neutral object:
the version originally considered for this page annotated Kashmir as a
"Disputed Area" with the Line of Control marked, which is not how the region is
represented within India and would have gone out to guests' feeds saying so. If
this image is ever replaced, check what the replacement asserts about that
border before shipping it.
