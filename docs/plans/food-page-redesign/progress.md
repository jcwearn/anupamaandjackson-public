# Progress: Photo-forward redesign of the What to Eat page

## Current Status: Complete

| Phase | Status | Updated | Notes |
|-------|--------|---------|-------|
| 1. Source & process images | Complete | 2026-08-01 | 24 jpg+webp pairs in src/assets/food/ + CC0 OG source; provenance below |
| 2. Data model, components, tests | Complete | 2026-08-02 | FoodPhoto/PhotoCredit in eats.ts; PhotoFrame; DishCard layouts; EatPlaceCard side photo; tests extended |
| 3. Page layout | Complete | 2026-08-02 | Hero triptych, feature/banner rhythm, arch section, alternating place cards, credits disclosure |
| 4. OG image + polish | Complete | 2026-08-02 | public/og-food.jpg (1200×630, CC0) wired into prerender.js |

## Image provenance log

One row per image as it is sourced (Phase 1). Author text is cleaned from Commons HTML.

All files downloaded from Wikimedia Commons at ≤1920px via `Special:FilePath`, resampled with
`sips` (1600/1200/1000px by display size), recompressed to jpeg q78, webp companion via
`cwebp -q 78`. `hero-*` files feed the header triptych; `og-source` (CC0) exists only to be cropped
into `public/og-food.jpg` and is not shipped in `src/assets/food/`.

| Slug | Commons file page | Author | License | Transform |
|------|-------------------|--------|---------|-----------|
| almond-house | ~~Commons burfi box~~ replaced 2026-08-02 with [Almond House's own bhel-squares product shot](https://thedesifood.com/media/Almond-House-Bhel-squares-200-g-1.webp) at Jackson's request | — | — | resized to 1000px, q78 |
| appam-and-stew | [File:Aapam-Stew.jpg](https://commons.wikimedia.org/wiki/File:Aapam-Stew.jpg) | Triv.rao | CC BY-SA 4.0 | resized, recompressed q78 |
| banti-bhojanam | [File:A_thali_served_on_banana_leaf_during_a_wedding,_south_India.jpg](https://commons.wikimedia.org/wiki/File:A_thali_served_on_banana_leaf_during_a_wedding,_south_India.jpg) | Sistak | CC BY-SA 2.0 | resized, recompressed q78 |
| chutneys | [File:Open_Dosa.jpg](https://commons.wikimedia.org/wiki/File:Open_Dosa.jpg) | Basavaraj M | CC BY-SA 4.0 | resized, recompressed q78 |
| filter-coffee | [File:Foaming_filter_coffee.jpg](https://commons.wikimedia.org/wiki/File:Foaming_filter_coffee.jpg) | Charles Haynes | CC BY-SA 2.0 | resized, recompressed q78 |
| gongura-pachadi | ~~Commons pachadi on a newspaper-lined table~~ replaced 2026-08-02 with [Pavani's Kitchen's gongura pachadi](https://www.pavaniskitchen.com/wp-content/uploads/2021/09/2.jpg) at Jackson's request | — | — | cropped 1200×800 from the 1200×1800 original at y660, clear of the "Gongura Pachadi" title (ends y185) and the pavaniskitchen.com watermark (starts y1650); resized to 1000px, q78 |
| guthi-vankaya | ~~Commons overhead of a pan~~ replaced 2026-08-02 with [Cake Work Orange's stuffed brinjal curry](https://cakeworkorange.com/wp-content/uploads/2020/11/stuffed-brinjal-curry.jpg) at Jackson's request | — | — | cropped 1904×1428 into the skillet from the 1908×3839 original, resized to 1200px, q78 |
| haleem | [File:Haleem_hyderabadi.jpg](https://commons.wikimedia.org/wiki/File:Haleem_hyderabadi.jpg) | Chandu7299 | CC BY-SA 4.0 | resized, recompressed q78 |
| hero-biryani | [File:Hyderabadi_Biryani_with_Raita,_Mirchi_Ka_Salan_and_Salad.JPG](https://commons.wikimedia.org/wiki/File:Hyderabadi_Biryani_with_Raita,_Mirchi_Ka_Salan_and_Salad.JPG) | Sumit Surai | CC BY-SA 4.0 | resized, recompressed q78 |
| hero-telugu | [File:Meal_BananaLeaf.JPG](https://commons.wikimedia.org/wiki/File:Meal_BananaLeaf.JPG) | Jpatokal | CC BY-SA 4.0 | resized, recompressed q78 |
| hero-tiffin | [File:South_Indian_Breakast_Idli_Vada_Sambar_Chutney.JPG](https://commons.wikimedia.org/wiki/File:South_Indian_Breakast_Idli_Vada_Sambar_Chutney.JPG) | Saind147 | CC BY-SA 4.0 | resized, recompressed q78 |
| hyderabadi-biryani | [File:Chicken_Hyderabadi_Biryani.JPG](https://commons.wikimedia.org/wiki/File:Chicken_Hyderabadi_Biryani.JPG) | Dheerajk88 | CC BY-SA 4.0 | resized, recompressed q78 |
| irani-chai | [File:Irani_chai_and_osmania_biscuits.jpg](https://commons.wikimedia.org/wiki/File:Irani_chai_and_osmania_biscuits.jpg) | manojkumar chidambaram | CC BY-SA 4.0 | resized, recompressed q78 |
| karachi-bakery | [File:Karachi_bakery_.jpg](https://commons.wikimedia.org/wiki/File:Karachi_bakery_.jpg) | Adbh266 | CC BY-SA 3.0 | resized, recompressed q78 |
| manam-chocolate | ~~Commons cacao pods on the tree~~ replaced 2026-08-02 with [Manam's own photograph of the karkhana frontage](https://manamchocolate.com/cdn/shop/files/1.jpg) at Jackson's request | — | — | cropped 1440×1080 off the left of the 2160×1080 original, so it fills the card's default 4:3 instead of leaving a letterbox over the text; resized to 1200px, q78 |
| mirchi-ka-salan | [File:Hyderabadi_Hari_Mirchi_Ka_Salan.JPG](https://commons.wikimedia.org/wiki/File:Hyderabadi_Hari_Mirchi_Ka_Salan.JPG) | Miansari66 | CC0 | resized, recompressed q78 |
| nimrah-cafe | [File:The_Charminar_from_Nimrah_Cafe.jpg](https://commons.wikimedia.org/wiki/File:The_Charminar_from_Nimrah_Cafe.jpg) | VISHNU SHANKAR P | CC BY-SA 4.0 | resized, recompressed q78 |
| og-source | [File:South_indian_meals_24.jpg](https://commons.wikimedia.org/wiki/File:South_indian_meals_24.jpg) | Swathi sri srinivasa raghavan | CC0 | cropped to 1200×630 for og-food.jpg |
| paradise | ~~Commons frontage shot from below~~ replaced 2026-08-02 with `paradisefoodcourt.in/images/gachibowli.jpg` at Jackson's request — **deliberately not linked**: that domain is the one the `paradise` entry in `eats.ts` warns has been taken over by gambling spam. The file is a genuine leftover asset of the old site (500×300, Exif intact; unknown paths under `/images/` fall through to a 244KB HTML page instead) | — | — | cropped 400×300 from 500×300, no resize — 500px is all the source has |
| pathar-ka-gosht | [File:Pattar_ka_gosht.JPG](https://commons.wikimedia.org/wiki/File:Pattar_ka_gosht.JPG) | Shaharbano | CC BY-SA 4.0 | resized, recompressed q78 |
| pulihora | ~~Commons tamarind rice in a kadai~~ replaced 2026-08-02 with [Cook's Hideout's tomato pulihora](https://www.cookshideout.com/wp-content/uploads/2015/03/Tomato-Pulihora2S.jpg) at Jackson's request | — | — | cropped 1200×800 around the bowl from the 1200×1807 original, resized to 1000px, q78 |
| qubani-ka-meetha | [File:Khobani_Ka_Meetha.JPG](https://commons.wikimedia.org/wiki/File:Khobani_Ka_Meetha.JPG) | Miansari66 | CC0 | resized, recompressed q78 |
| subbayya | [File:Subbayya_gari_Hotel.jpg](https://commons.wikimedia.org/wiki/File:Subbayya_gari_Hotel.jpg) | Rajasekhar1961 | CC BY-SA 4.0 | resized, recompressed q78 |
| tiffin | ~~Commons idli-vada on a banana leaf~~ replaced 2026-08-02 with [Slurrp's tiffin platter](https://images.slurrp.com/webstories/wp-content/uploads/2023/05/shutterstock_1153818430.jpg) at Jackson's request | — | — | cropped 666×834 from the 667×1000 original, no resize (no larger source exists), q78 |
| uttapam | [File:Onion_Uttappam_01.jpg](https://commons.wikimedia.org/wiki/File:Onion_Uttappam_01.jpg) | Ganesh Mohan T | CC BY-SA 4.0 | resized, recompressed q78 |

| jewel-of-nizam | replaced 2026-08-02 with [the Minar tower at dusk from TripAdvisor](https://media-cdn.tripadvisor.com/media/photo-o/07/ed/d8/01/jewel-of-nizam-the-minar.jpg) at Jackson's request (previously reused the Hotels page's Golkonda photo) | — | — | resized to 1000px, q78 |

**2026-08-02 — credits removed from the page.** Jackson asked for the photo-credits disclosure to
go; it was removed along with the `credit` fields in `eats.ts`. This table is now the only
attribution record. The CC BY / CC BY-SA files above formally require attribution at the point of
use — restoring the disclosure just means re-adding `credit` fields from this table.

**2026-08-02 — four dish photos swapped.** Jackson supplied better pictures for `pulihora`,
`gongura-pachadi`, `guthi-vankaya` and `tiffin`; the Commons originals were the four weakest on the
page. Each replacement is pre-cropped to the aspect its card renders at, so `object-cover` has
nothing left to cut: 3:2 for the two stack cards, 4:3 for the `feature` card, 4:5 for the arch. The
alt text was rewritten with them — the old strings named a brass kadai, onion rings and a leaf with
no dosa on it, none of which the new photos show. `guthi-vankaya` carries the photographer's own
faint "Cakeworkorange" watermark; it was left in rather than painted out.

Notes on what each picture shows (for honest alt text):
- `banti-bhojanam`: diners eating from banana leaves in long rows at a South Indian wedding — matches the note's "everyone sits in long lines".
- `paradise`, `karachi-bakery`, `subbayya`, `nimrah-cafe`, `manam-chocolate`: the actual venues (Nimrah's is the Charminar seen over the café's own cups; Manam's is the karkhana frontage, as of 2026-08-02).
- `chutneys`: an open dosa with chutneys — representative dish, not the venue.
- `almond-house`: a mixed mithai box — representative, not the venue.
- `jewel-of-nizam` reuses the hotel's own photo from `src/assets/hotels/` (no Commons credit needed).

## Handoff Notes

Branch `feat/food-page-photos`, stacked on `feat/eat-like-a-local` (PR #230); the PR targets
`feat/eat-like-a-local`, not `main`. Tests need Node 24 (`nvm use 24`). Preview URLs need a
trailing slash (`/travel/food/`).

Done and verified: 382 tests green, `npm run build` clean, Chrome CDP checks (25 photos load,
width/height reserved, no horizontal overflow at 1280/375, feature/mirror/alternating layouts
correct, credits disclosure carries 24 entries) and a Firefox screenshot pass.

Decisions worth knowing: Chutneys/Almond House/Manam use representative photos (dosa, mithai box,
cacao pods) with alt text that never claims to show the venue; Jewel of Nizam reuses the
Golkonda Resorts photo from `src/assets/hotels/` (no credit needed); the OG image is deliberately
CC0 so it travels off-site without the credits disclosure; the CC0 license URL is written https
(the API returns http, and the tests require https).
