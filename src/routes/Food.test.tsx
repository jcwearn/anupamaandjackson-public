import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Food from './Food'
import Hyderabad from './Hyderabad'
import TravelTips from './TravelTips'
import Faq from './Faq'
import type { Diet, FoodPhoto } from '../data/eats'
import { dishGroups, eatPlaces, heroPhotos } from '../data/eats'
import { places } from '../data/places'

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Element.prototype.scrollIntoView = vi.fn()
})

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const allDishes = dishGroups.flatMap((group) => group.dishes)

// Every photo the data ships, wherever it hangs: the header arches, the dish
// cards, the place cards.
const allPhotos: FoodPhoto[] = [
  ...heroPhotos,
  ...allDishes.flatMap((dish) => (dish.photo ? [dish.photo] : [])),
  ...eatPlaces.flatMap((place) => (place.photo ? [place.photo] : [])),
]

describe('What to Eat', () => {
  it('keeps every slug unique and URL-safe', () => {
    // The dishes, the eat places and the page's own section headings all render
    // into one document, so a collision would give two elements the same id and
    // send a deep link to whichever the browser found first.
    const { container } = renderPage(<Food />)
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size, 'duplicate id on the page').toBe(ids.length)
    for (const id of ids) {
      expect(id, `"${id}" needs no escaping in a URL fragment`).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('renders every dish and every place, under its own id', () => {
    const { container } = renderPage(<Food />)

    for (const dish of allDishes) {
      expect(screen.getByRole('heading', { name: dish.name })).toBeInTheDocument()
      expect(screen.getByText(dish.kind)).toBeInTheDocument()
      expect(screen.getByText(dish.note)).toBeInTheDocument()
      expect(container.querySelectorAll(`#${dish.slug}`), `#${dish.slug}`).toHaveLength(1)
    }

    for (const place of eatPlaces) {
      expect(screen.getByRole('heading', { name: place.name })).toBeInTheDocument()
      expect(screen.getByText(place.area)).toBeInTheDocument()
      expect(screen.getByText(place.note)).toBeInTheDocument()
      expect(container.querySelectorAll(`#${place.slug}`), `#${place.slug}`).toHaveLength(1)
    }
  })

  it('caveats the non-veg dishes before it lists any of them', () => {
    // Every meal across the wedding events is vegetarian (/faq#food), and the
    // non-veg recommendations are second-hand. Both belong above the list rather
    // than after it — a reader who stops halfway must not come away thinking we
    // vouched for a mutton dish or that one is on the menu.
    const { container } = renderPage(<Food />)

    expect(screen.getByRole('heading', { name: 'Vegetarian & vegan' })).toBeInTheDocument()
    expect(screen.getByText(/the city’s word rather than ours/)).toBeInTheDocument()
    expect(screen.getByText(/ghee and curd turn up unannounced/)).toBeInTheDocument()

    const caveat = container.querySelector('#vegetarian-and-vegan')!
    const firstDish = container.querySelector(`#${allDishes[0].slug}`)!

    expect(
      caveat.compareDocumentPosition(firstDish) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the caveat has to come before the dishes'
    ).toBeTruthy()
  })

  it('badges every dish, and explains all three marks', () => {
    // Whether a badge matches its note is a copy question — a regex over prose
    // can't tell "comes vegetable or chicken, so say which" (a warning on a
    // vegan dish) from a mislabelled one. What is worth pinning down: every dish
    // carries a mark, the mark it carries is the one it renders, and the legend
    // covers all three, or the icons are just decoration.
    const { container } = renderPage(<Food />)
    const badges: Record<Diet, string> = { vegan: 'Vegan', veg: 'Veg', 'non-veg': 'Non-veg' }

    for (const dish of allDishes) {
      expect(Object.keys(badges), `${dish.slug} has no diet`).toContain(dish.diet)

      const card = container.querySelector(`#${dish.slug}`)!
      expect(card.textContent, `${dish.slug} shows no ${badges[dish.diet]} badge`).toContain(
        badges[dish.diet]
      )
    }

    for (const label of Object.values(badges)) {
      expect(screen.getAllByText(label).length, `no legend entry for ${label}`).toBeGreaterThan(0)
    }
  })

  it('points every cross-link at a slug from the right list', () => {
    const eatPlaceSlugs = new Set(eatPlaces.map((place) => place.slug))
    const placeSlugs = new Set(places.map((place) => place.slug))

    for (const dish of allDishes) {
      if (!dish.whereSlug) continue
      expect(eatPlaceSlugs.has(dish.whereSlug), `${dish.slug} → #${dish.whereSlug}`).toBe(true)
    }
    for (const place of eatPlaces) {
      if (!place.nearbySlug) continue
      expect(placeSlugs.has(place.nearbySlug), `${place.slug} → #${place.nearbySlug}`).toBe(true)
    }
  })

  it('every in-page jump lands on something this page renders', () => {
    const { container } = renderPage(<Food />)
    const ids = new Set([...container.querySelectorAll('[id]')].map((el) => el.id))
    const fragments = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')!.slice(1)
    )

    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(ids.has(fragment), `nothing on this page has #${fragment}`).toBe(true)
    }
  })

  it('every cross-page deep link resolves on the page it names', () => {
    // The sights live on Things to Do and the wedding menu on the FAQ, so these
    // links leave the page — a renamed anchor over there would go dead silently.
    const others: [string, React.ReactElement][] = [
      ['/travel/hyderabad', <Hyderabad key="h" />],
      ['/travel/tips', <TravelTips key="t" />],
      ['/faq', <Faq key="f" />],
    ]

    for (const [path, ui] of others) {
      const other = renderPage(ui)
      const ids = new Set([...other.container.querySelectorAll('[id]')].map((el) => el.id))
      other.unmount()

      const { container, unmount } = renderPage(<Food />)
      const fragments = [...container.querySelectorAll(`a[href^="${path}#"]`)].map(
        (a) => a.getAttribute('href')!.split('#')[1]
      )
      unmount()

      expect(fragments.length, `no ${path}# links to check`).toBeGreaterThan(0)
      for (const fragment of fragments) {
        expect(ids.has(fragment), `${path} has no #${fragment}`).toBe(true)
      }
    }
  })

  it('sends every off-site link out safely, over https', () => {
    const urls = [
      ...allDishes.map((dish) => dish.searchUrl),
      ...eatPlaces.flatMap((place) => [place.websiteUrl, place.mapUrl]),
    ].filter((url): url is string => Boolean(url))

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(new URL(url).protocol, url).toBe('https:')
    }

    const { container } = renderPage(<Food />)
    const external = [...container.querySelectorAll('a[href^="http"]')]

    expect(external.length).toBe(urls.length)
    for (const link of external) {
      expect(link.getAttribute('target'), link.getAttribute('href')!).toBe('_blank')
      expect(link.getAttribute('rel'), link.getAttribute('href')!).toBe('noopener noreferrer')
    }
  })

  it('describes every photo and reserves its box before it loads', () => {
    // Twenty-odd lazy images above and below the fold: without width/height
    // the page reflows under the reader as each one arrives, and without alt
    // text a screen reader gets a page of unexplained decorations.
    renderPage(<Food />)

    expect(allPhotos.length).toBeGreaterThan(0)
    for (const photo of allPhotos) {
      expect(photo.alt.trim(), `${photo.src} has no alt text`).not.toBe('')
      expect(photo.width, `${photo.src} has no width`).toBeGreaterThan(0)
      expect(photo.height, `${photo.src} has no height`).toBeGreaterThan(0)

      const img = screen.getByAltText(photo.alt)
      expect(img).toHaveAttribute('width', String(photo.width))
      expect(img).toHaveAttribute('height', String(photo.height))
    }
  })

})
