/**
 * The content of every generated OG image, one entry per page.
 *
 * build-og-images.js renders each of these through template.js and screenshots
 * the result; tests/ogManifest.test.js checks the list against the routes in
 * prerender.js, so a page that gains an og-*.jpg without an entry here (or the
 * reverse) fails rather than silently shipping the wrong preview.
 *
 * The couple line is baked into the template — only `date` moves. `photo` is
 * relative to the repo root.
 *
 * Three variants, picked by the shape of the photograph:
 *   split      (default) portrait arch beside the text — a centred, vertical
 *              subject: a person, a monument, a plate shot from above
 *   landscape  a wide flattened arch under the text — a subject that needs its
 *              width: a facade, a boat on the backwaters
 *   centered   no photo at all, text at full size — for pages where nothing in
 *              the repo fits. Better than cropping a bad photo to have one.
 *
 * Getting this wrong is what the crop eats: a six-across family photo in the
 * portrait arch keeps the middle two people, and a houseboat keeps a wall of
 * water.
 *
 * `photoPosition` is a CSS object-position, and which half of it does anything
 * depends on the variant — the portrait panel overflows a landscape source
 * horizontally, the landscape panel overflows it vertically. The other half is
 * inert. `titleSize` overrides the variant's default for titles that would wrap.
 */

const WEDDING_DATE = 'October 28, 2026  •  Hyderabad, India'

export const manifest = [
  {
    slug: 'home',
    output: 'og-home.jpg',
    route: '/',
    title: 'Anupama & Jackson',
    // The title is already the couple line.
    showNames: false,
    date: WEDDING_DATE,
    titleSize: 76,
    photo: 'src/assets/sangeet.jpg',
    alt: 'Anupama & Jackson — October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'schedule',
    output: 'og-schedule.jpg',
    route: '/schedule',
    eyebrow: 'Four days of celebration',
    title: 'The Schedule',
    date: WEDDING_DATE,
    photo: 'src/assets/story/falaknuma.jpg',
    alt: 'The Schedule — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'hotels',
    output: 'og-hotels.jpg',
    route: '/hotels',
    eyebrow: "Where you'll stay",
    title: 'Where to Stay',
    date: WEDDING_DATE,
    // A hotel facade is a wide subject, so this is the landscape panel. The Taj
    // shot is taken from above and well back, which leaves the building small
    // and the foreground full of car park; the Leela is photographed square-on
    // at dusk and fills the frame.
    variant: 'landscape',
    photo: 'src/assets/hotels/leela-hyderabad.jpg',
    photoPosition: 'center 53%',
    alt: 'Where to Stay — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'travel',
    output: 'og-travel.jpg',
    route: '/travel',
    eyebrow: 'Planning your trip',
    title: 'Getting Here',
    date: WEDDING_DATE,
    // IndiGo A320neo on approach, by BriYYZ via Wikimedia Commons, CC BY-SA 2.0
    // — a share-alike licence, so it needs a credit anywhere but here. See
    // docs/credits.md.
    variant: 'landscape',
    photo: 'src/assets/travel/indigo-a320neo.jpg',
    // Lifts the aircraft off the bottom edge — a centred crop leaves the gear
    // almost touching the frame.
    photoPosition: 'center 58%',
    alt: 'Getting Here — an IndiGo jet on approach, Anupama & Jackson',
  },
  {
    slug: 'hyderabad',
    output: 'og-hyderabad.jpg',
    route: '/travel/hyderabad',
    eyebrow: 'Things to do',
    title: 'Exploring Hyderabad',
    date: WEDDING_DATE,
    // charminar.jpg with 60px of sky added above it — see docs/credits.md. The
    // original has barely any headroom over the minaret finials, and the arch
    // clips its top corners exactly where they sit.
    photo: 'src/assets/hyderabad/charminar-og.jpg',
    alt: 'Exploring Hyderabad — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'food',
    output: 'og-food.jpg',
    route: '/travel/food',
    eyebrow: 'What to eat',
    title: 'A City of Two Kitchens',
    date: WEDDING_DATE,
    // Shot from overhead on a round plate — it fills the arch without a crop.
    photo: 'src/assets/food/tiffin.jpg',
    alt: 'A City of Two Kitchens — a South Indian tiffin plate, Anupama & Jackson',
  },
  {
    slug: 'travel-tips',
    output: 'og-travel-tips.jpg',
    route: '/travel/tips',
    eyebrow: 'Before you go',
    title: 'India Travel Tips',
    date: WEDDING_DATE,
    // A relief map, not a city map. The labelled one has hundreds of town names
    // on it, and at the size a link preview is actually read they collapse into
    // grey speckle with the legend box sitting in frame as a block of noise.
    // Uwe Dedering, via Wikimedia Commons, CC BY-SA 3.0 — see docs/credits.md.
    photo: 'src/assets/travel/india-relief-map.jpg',
    // The frame runs east to Myanmar, so a centred crop puts the Bay of Bengal
    // in the middle and pushes the peninsula to the edge. Pinned hard left,
    // which lands the southern tip on the centre line.
    photoPosition: '0% center',
    alt: 'India Travel Tips — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'faq',
    output: 'og-faq.jpg',
    route: '/faq',
    eyebrow: 'Everything you asked',
    title: 'Questions & Answers',
    date: WEDDING_DATE,
    // Not story/families.jpg — six people across a landscape frame, and the
    // arch crops it down to the middle two.
    photo: 'src/assets/story/engagement-park.jpg',
    alt: 'Questions & Answers — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    slug: 'what-to-wear',
    output: 'og-what-to-wear.jpg',
    route: '/what-to-wear',
    eyebrow: 'Kurtas, saris & the rest',
    title: 'What to Wear',
    date: WEDDING_DATE,
    // The green Gadwal sari: a centred, full-length figure on a plain backdrop,
    // which is exactly what the portrait arch wants. The red brocade one is the
    // prettier picture and the wrong shape — its backdrop fills the arch and the
    // sari loses its border to the crop.
    photo: 'src/assets/attire/sari-1.jpg',
    alt: 'What to Wear — a guide to Indian wedding clothes for our guests',
  },
  {
    slug: 'bookshelf',
    output: 'og-bookshelf.jpg',
    route: '/bookshelf',
    eyebrow: 'Read & watch first',
    title: 'The Bookshelf',
    date: WEDDING_DATE,
    // No single photo represents the page, so the panel holds a shelf of the
    // covers instead — the page's own Shelf3D, flattened.
    covers: [
      'src/assets/shelf/a-fine-balance.jpg',
      'src/assets/shelf/midnights-children.jpg',
      'src/assets/shelf/the-god-of-small-things.jpg',
      'src/assets/shelf/rrr.jpg',
      'src/assets/shelf/3-idiots.jpg',
      'src/assets/shelf/the-darjeeling-limited.jpg',
    ],
    alt: 'The Bookshelf — books and films to read and watch before the wedding',
  },
  {
    slug: 'kerala-itinerary',
    output: 'og-kerala-itinerary.jpg',
    route: '/kerala-itinerary',
    eyebrow: 'After the wedding',
    title: 'A Lush Kerala Weekend',
    date: 'October 29 – November 1, 2026',
    // The backwaters are the reason for the trip, and a houseboat on them is a
    // long horizontal subject — the portrait arch cropped it to a wall of
    // water, which is what the landscape panel exists to avoid.
    variant: 'landscape',
    photo: 'src/assets/kerala/houseboat.jpg',
    // The boat sits above the middle of the frame, so a centred crop hangs it
    // near the top of the panel with all the water below.
    photoPosition: 'center 34%',
    alt: 'A Lush Kerala Weekend — Anupama & Jackson, October 29 – November 1, 2026',
  },
  {
    slug: 'evisa',
    output: 'og-evisa.jpg',
    route: '/evisa',
    eyebrow: 'A guide for our guests',
    title: 'India e-Visa Helper',
    date: WEDDING_DATE,
    // Provenance unknown — supplied from a third-party CDN, not Commons, so
    // there is no licence to point at. See docs/credits.md before reusing it.
    photo: 'src/assets/travel/passport-stamps.jpg',
    alt: 'India e-Visa Helper — a passport open at its visa stamps, Anupama & Jackson',
  },
]
