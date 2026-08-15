import React from 'react'
import clsx from 'clsx'
import { books, films, shelfItems, type ShelfItem } from '../data/shelf'
import Shelf3D from '../components/Shelf3D'
import { restingDeg } from '../lib/motion'
import ShelfPullout from '../components/ShelfPullout'

type ShelfTab = 'books' | 'movies'

const TABS: { id: ShelfTab; label: string }[] = [
  { id: 'books', label: 'Books' },
  { id: 'movies', label: 'Movies & Media' },
]

const tabFor = (item: ShelfItem): ShelfTab => (item.kind === 'book' ? 'books' : 'movies')

// StorySection's pill, not StickyChipBar's chip — same reasoning as there.
const tabClass = (active: boolean) =>
  clsx(
    'whitespace-nowrap rounded-full px-5 py-2 font-body text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:text-base',
    active ? 'bg-rosewood text-cream shadow-sm' : 'text-zeus/70 hover:bg-lily/40',
  )

/**
 * Books to read and films to watch before travelling to India: two shelves
 * behind a Books / Movies toggle, every item a 3D spine or case that pulls off
 * the shelf into a detail overlay.
 *
 * The URL fragment deep-links both layers: #rrr opens the Movies shelf with RRR
 * pulled out, #books and #movies just pick a shelf. Fragments are written with
 * `replaceState`, never `navigate` — the PlaceCarousel rationale.
 */
const Bookshelf: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<ShelfTab>('books')
  const [pulled, setPulled] = React.useState<{
    item: ShelfItem
    fromRect: DOMRect | null
    fromDeg?: number
  } | null>(null)
  const tabRefs = React.useRef<Record<ShelfTab, HTMLButtonElement | null>>({
    books: null,
    movies: null,
  })
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  // Land on whatever the fragment names, and follow inbound hash changes. On
  // mount there is no shelf position to pull from, so the overlay just appears.
  React.useEffect(() => {
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (hash === 'books' || hash === 'movies') {
        setActiveTab(hash)
        return
      }
      const item = shelfItems.find((i) => i.slug === hash)
      if (item) {
        setActiveTab(tabFor(item))
        setPulled({ item, fromRect: null })
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const openItem = (item: ShelfItem, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    // The copy must park exactly on the shelf box, so measure the button's
    // untransformed layout rect: the 3D transform is origin-centred, so it
    // never moves the centre — but the transformed AABB is both taller (top
    // face) and off-centre (the side face bulges one way), and anchoring on
    // it left the copy a couple of pixels off. Clearing the transform for one
    // synchronous measurement costs a reflow, no paint.
    const prevTransform = trigger.style.transform
    trigger.style.transform = 'none'
    const layoutRect = trigger.getBoundingClientRect()
    trigger.style.transform = prevTransform
    // And the shelf position's own resting angle, or the copy snaps to a
    // different turn on its first frame.
    const shelfmates = item.kind === 'book' ? books : films
    setPulled({
      item,
      fromRect: layoutRect,
      fromDeg: restingDeg(shelfmates.indexOf(item)),
    })
    window.history.replaceState(null, '', `#${item.slug}`)
  }

  // Focus goes back to the spine that was pulled, or closing the overlay drops
  // the reader at the top of the document. On the next frame, not now: the
  // spine is still `visibility: hidden` until the state above re-renders, and
  // Chrome silently refuses to focus a hidden element.
  const handleClosed = React.useCallback(() => {
    setPulled(null)
    // preventScroll: the overlay's scroll lock has just restored the page to
    // exactly where the reader left it — and the trigger is visible there, so
    // letting focus scroll would only yank the page somewhere else.
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const switchTab = (tab: ShelfTab) => {
    setActiveTab(tab)
    // A fragment naming an item on the other shelf would be a lie.
    window.history.replaceState(null, '', window.location.pathname)
  }

  const activeIndex = TABS.findIndex((t) => t.id === activeTab)

  const move = (delta: number) => {
    const next = TABS[(activeIndex + delta + TABS.length) % TABS.length]
    switchTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const jump: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      Home: () => switchTab(TABS[0].id),
      End: () => switchTab(TABS[TABS.length - 1].id),
    }
    const handler = jump[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">The Bookshelf</h1>
          <p className="mx-auto mt-4 max-w-xl font-body text-lg leading-relaxed text-zeus/80">
            India is easier to fall for on arrival if you’ve already met it in print and on screen.
            Here are eight books and eight films we love — start anywhere, and pull one off the
            shelf to see why it made the cut.
          </p>
        </div>
      </header>

      <div className="py-10 pb-16">
        <div className="flex justify-center px-4">
          <div
            role="tablist"
            aria-label="Which shelf to browse"
            onKeyDown={onTabKeyDown}
            className="inline-flex gap-1 rounded-full bg-white/70 p-1 ring-1 ring-gold/50"
          >
            {TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el
                  }}
                  type="button"
                  role="tab"
                  id={`shelf-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`shelf-panel-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => switchTab(tab.id)}
                  className={tabClass(active)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Both shelves stay in the DOM — the page is prerendered, so hiding
            the inactive one with `hidden` keeps all sixteen titles in the
            shipped HTML for search and anyone reading before hydration. */}
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          const items = tab.id === 'books' ? books : films
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`shelf-panel-${tab.id}`}
              aria-labelledby={`shelf-tab-${tab.id}`}
              hidden={!active}
              className="mt-8"
            >
              <div className="mx-auto max-w-3xl">
                <Shelf3D
                  items={items}
                  variant={tab.id === 'books' ? 'spine' : 'case'}
                  pulledSlug={pulled && tabFor(pulled.item) === tab.id ? pulled.item.slug : null}
                  onSelect={openItem}
                />
              </div>
            </div>
          )
        })}
      </div>

      {pulled && (
        <ShelfPullout
          item={pulled.item}
          fromRect={pulled.fromRect}
          fromDeg={pulled.fromDeg}
          onClose={handleClosed}
        />
      )}
    </div>
  )
}

export default Bookshelf
