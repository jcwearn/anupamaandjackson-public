import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Routes to prerender with their metadata. Exported so prerenderRoutes.test.tsx
// can check this list against the routes entry-server.tsx actually serves —
// they're written out separately, and a path in one and not the other fails
// silently as a page that redirects home.
export const routes = [
  {
    path: '/',
    outputPath: 'dist/index.html',
    title: 'Anupama & Jackson',
    description:
      "Anupama & Jackson are getting married — October 28, 2026 in Hyderabad, India. We can't wait to celebrate with everyone!",
    ogImage: 'https://anupamaandjackson.com/og-home.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Anupama & Jackson — October 28, 2026, Hyderabad, India',
  },
  {
    path: '/save-the-date',
    outputPath: 'dist/save-the-date/index.html',
    title: 'Save the Date - Anupama & Jackson',
    description: "We're getting married! Save the date for our celebration.",
    ogImage: 'https://anupamaandjackson.com/og-save-the-date.jpg',
  },
  {
    path: '/schedule',
    outputPath: 'dist/schedule/index.html',
    title: 'Wedding Schedule - Anupama & Jackson',
    description:
      'The schedule for our wedding celebrations in Hyderabad — add your name to see the events you are invited to. October 26–29, 2026.',
    ogImage: 'https://anupamaandjackson.com/og-schedule.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'The Schedule — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    path: '/evisa',
    outputPath: 'dist/evisa/index.html',
    title: 'India e-Visa Helper - Anupama & Jackson',
    description: 'A guide to the Indian e-Visa process for our wedding guests, with tools to resize your headshot and passport files to meet the upload limits.',
    ogImage: 'https://anupamaandjackson.com/og-evisa.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'India e-Visa Helper — a passport open at its visa stamps, Anupama & Jackson',
  },
  {
    path: '/kerala-itinerary',
    outputPath: 'dist/kerala-itinerary/index.html',
    title: 'A Lush Kerala Weekend - Anupama & Jackson',
    description: 'Four days in Kerala after the wedding: Kochi, a Kathakali cultural evening, an Alleppey houseboat on the backwaters, and Fort Kochi sightseeing. October 29 – November 1, 2026.',
    ogImage: 'https://anupamaandjackson.com/og-kerala-itinerary.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'A Lush Kerala Weekend — Anupama & Jackson, October 29 – November 1, 2026',
  },
  {
    path: '/hotels',
    outputPath: 'dist/hotels/index.html',
    title: 'Where to Stay - Anupama & Jackson',
    description: 'Hotel options near our wedding events in Hyderabad — Pellikuthuru at Banjara Hills, and the Edurukolu, Muhurtham & Reception at Golkonda Resorts and Spa. October 28, 2026.',
    ogImage: 'https://anupamaandjackson.com/og-hotels.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Where to Stay — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    // Unlinked, and its contents are gated on the `admin` tag at runtime — so
    // the prerendered HTML holds only the locked state. Meta is deliberately
    // uninformative: this file is fetchable by anyone who guesses the path.
    path: '/invites/links',
    outputPath: 'dist/invites/links/index.html',
    title: 'Invite Links - Anupama & Jackson',
    description: 'Invitation links for Anupama & Jackson’s wedding.',
    ogImage: null,
  },
  {
    path: '/travel',
    outputPath: 'dist/travel/index.html',
    title: 'Getting Here - Anupama & Jackson',
    description:
      'Getting to Hyderabad for the wedding — which airport to fly into, when to arrive, and how to reach Golkonda Resort once you land.',
    ogImage: 'https://anupamaandjackson.com/og-travel.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Getting Here — an IndiGo jet on approach, Anupama & Jackson',
  },
  {
    path: '/travel/hyderabad',
    outputPath: 'dist/travel/hyderabad/index.html',
    title: 'Things to Do in Hyderabad - Anupama & Jackson',
    description:
      'A guide to Hyderabad for our wedding guests — Charminar, Golconda Fort, Chowmahalla Palace, the Qutb Shahi Tombs, Salar Jung Museum, Birla Mandir, Hussain Sagar, Laad Bazaar and Shilparamam, and a few ways to spend a free day.',
    ogImage: 'https://anupamaandjackson.com/og-hyderabad.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt:
      'Exploring Hyderabad — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    path: '/travel/food',
    outputPath: 'dist/travel/food/index.html',
    title: 'What to Eat in Hyderabad - Anupama & Jackson',
    description:
      'A food guide to Hyderabad and South India for our wedding guests — the city’s two kitchens, Muslim and Telugu, from biryani and Irani chai to gongura and banana-leaf meals, plus where to go for them and how to eat vegetarian or vegan while you’re here.',
    ogImage: 'https://anupamaandjackson.com/og-food.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'A City of Two Kitchens — a South Indian tiffin plate, Anupama & Jackson',
  },
  {
    // Moved from /travel-tips; public/_redirects 301s the old path here, so this
    // route must not also be emitted at dist/travel-tips/index.html — Cloudflare
    // Pages serves a matching static file in preference to a redirect rule.
    path: '/travel/tips',
    outputPath: 'dist/travel/tips/index.html',
    title: 'India Travel Tips - Anupama & Jackson',
    description:
      'Practical tips for our wedding guests traveling to India — airport arrival, getting around by Uber and auto, staying connected, where you’re staying, eating safely, what to pack, money, and local etiquette.',
    ogImage: 'https://anupamaandjackson.com/og-travel-tips.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'India Travel Tips — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    path: '/faq',
    outputPath: 'dist/faq/index.html',
    title: 'Questions & Answers - Anupama & Jackson',
    description:
      'Answers to what our wedding guests ask most — RSVPs and plus-ones, weather, parking and accessibility, the vegetarian menu, what to wear (and where to shop for it), and getting yourself to India.',
    ogImage: 'https://anupamaandjackson.com/og-faq.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt:
      'Questions & Answers — Anupama & Jackson, October 28, 2026, Hyderabad, India',
  },
  {
    path: '/what-to-wear',
    outputPath: 'dist/what-to-wear/index.html',
    title: 'What to Wear - Anupama & Jackson',
    description:
      'A picture guide to Indian wedding clothes — kurta pajama, sherwani, bandhgala and the Telugu dhoti pant for men; the sari, lehenga, anarkali, sharara and more for women — plus where to shop for them.',
    ogImage: 'https://anupamaandjackson.com/og-what-to-wear.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'What to Wear — a guide to Indian wedding clothes for our guests',
  },
  {
    path: '/bookshelf',
    outputPath: 'dist/bookshelf/index.html',
    title: 'The Bookshelf - Anupama & Jackson',
    description:
      'Books to read and films to watch before you travel to India for the wedding — eight books and eight films we love, from A Fine Balance to RRR.',
    ogImage: 'https://anupamaandjackson.com/og-bookshelf.jpg',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'The Bookshelf — books and films to read and watch before the wedding',
  },
  {
    path: '/engagement',
    outputPath: 'dist/engagement/index.html',
    title: 'Engagement Weekend - Anupama & Jackson',
    description: 'Join Anupama & Jackson in Atlanta for their engagement weekend - August 16, 2025.',
    ogImage: null,
  },
  {
    path: '/engagement/schedule',
    outputPath: 'dist/engagement/schedule/index.html',
    title: 'Schedule - Anupama & Jackson',
    description: 'Schedule for Anupama & Jackson\'s engagement weekend in Atlanta.',
    ogImage: null,
  },
  {
    path: '/invites/wearn',
    outputPath: 'dist/invites/wearn/index.html',
    title: "You're Invited - Anupama & Jackson",
    description: "Join us in celebrating Anupama & Jackson's wedding.",
    ogImage: 'https://anupamaandjackson.com/invites/cover-page.jpeg',
  },
  {
    path: '/invites/tadanki',
    outputPath: 'dist/invites/tadanki/index.html',
    title: "You're Invited - Anupama & Jackson",
    description: "Join us in celebrating Anupama & Jackson's wedding.",
    ogImage: 'https://anupamaandjackson.com/invites/cover-page.jpeg',
  },
  {
    path: '/invites/tadanki/reception',
    outputPath: 'dist/invites/tadanki/reception/index.html',
    title: "You're Invited - Anupama & Jackson",
    description: "Join us in celebrating Anupama & Jackson's wedding.",
    ogImage: 'https://anupamaandjackson.com/invites/cover-page.jpeg',
  },
  {
    path: '/invites/tadanki/muhurtham',
    outputPath: 'dist/invites/tadanki/muhurtham/index.html',
    title: "You're Invited - Anupama & Jackson",
    description: "Join us in celebrating Anupama & Jackson's wedding.",
    ogImage: 'https://anupamaandjackson.com/invites/cover-page.jpeg',
  },
]

async function prerender() {
  console.log('Starting prerender...')

  // Read the built template HTML
  const templatePath = join(root, 'dist', 'index.html')
  const template = await readFile(templatePath, 'utf-8')

  // Load the SSR entry from the production SSR build (dist-server), so asset
  // imports resolve to the same hashed /assets/ URLs as the client build.
  // A dev-mode ssrLoadModule would emit /src/... paths that 404 in production.
  const entryPath = pathToFileURL(join(root, 'dist-server', 'entry-server.js')).href
  const { render } = await import(entryPath)

  for (const route of routes) {
    console.log(`Prerendering ${route.path}...`)

    // Render the app to string
    const appHtml = await render(route.path)

    // Build meta tags
    const metaTags = buildMetaTags(route)

    // Inject rendered HTML and meta tags into template
    let html = template
      .replace('<!--ssr-outlet-->', appHtml)
      .replace('<!--ssr-head-->', metaTags)
      .replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`)

    // Ensure output directory exists
    const outputPath = join(root, route.outputPath)
    await mkdir(dirname(outputPath), { recursive: true })

    // Write the prerendered HTML
    await writeFile(outputPath, html)
    console.log(`  -> ${route.outputPath}`)
  }

  console.log('Prerender complete!')
}

function buildMetaTags(route) {
  const tags = []

  // Base meta tags
  tags.push(`<meta name="description" content="${route.description}" />`)

  // OG tags
  tags.push(`<meta property="og:type" content="website" />`)
  tags.push(`<meta property="og:url" content="https://anupamaandjackson.com${route.path}" />`)
  tags.push(`<meta property="og:title" content="${route.title}" />`)
  tags.push(`<meta property="og:description" content="${route.description}" />`)
  tags.push(`<meta property="og:site_name" content="Anupama & Jackson" />`)

  if (route.ogImage) {
    tags.push(`<meta property="og:image" content="${route.ogImage}" />`)
    if (route.ogImageWidth && route.ogImageHeight) {
      tags.push(`<meta property="og:image:width" content="${route.ogImageWidth}" />`)
      tags.push(`<meta property="og:image:height" content="${route.ogImageHeight}" />`)
    }
    if (route.ogImageAlt) {
      tags.push(`<meta property="og:image:alt" content="${route.ogImageAlt}" />`)
    }
  }

  // Twitter tags
  tags.push(`<meta name="twitter:card" content="${route.ogImage ? 'summary_large_image' : 'summary'}" />`)
  tags.push(`<meta name="twitter:title" content="${route.title}" />`)
  tags.push(`<meta name="twitter:description" content="${route.description}" />`)

  if (route.ogImage) {
    tags.push(`<meta name="twitter:image" content="${route.ogImage}" />`)
    if (route.ogImageAlt) {
      tags.push(`<meta name="twitter:image:alt" content="${route.ogImageAlt}" />`)
    }
  }

  return tags.join('\n    ')
}

// Only when run as a script. prerenderRoutes.test.tsx imports `routes` from
// here, and tests run before the build — so importing this module must not go
// looking for a dist/ that isn't there yet and take the process down with it.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  prerender().catch((err) => {
    console.error('Prerender failed:', err)
    process.exit(1)
  })
}
