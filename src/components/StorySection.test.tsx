import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import StorySection from './StorySection'
import {
  STORY_TRAVEL_HEADING,
  storyAccounts,
  storyClosingPhoto,
  storyTravelPhotos,
} from '../data/story'

const tablist = () => screen.getByRole('tablist')
const tabs = () => within(tablist()).getAllByRole('tab')
const panels = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
]

describe('StorySection', () => {
  it('keeps both accounts in the DOM whichever tab is showing', () => {
    // The page is prerendered, so a panel that only exists once JS has run is a
    // panel that never reaches search, link previews, or a pre-hydration visit.
    // Hiding the inactive one with `hidden` is what keeps the whole story in
    // the shipped HTML — asserting it here is asserting that contract.
    const { container } = render(<StorySection />)

    expect(container.textContent).toContain('It was a very ordinary day')
    expect(container.textContent).toContain('Our story starts like many in the modern age')
  })

  it('gives each opening letter its own drop cap offset', () => {
    // The side margins are deliberately equal: with the whole gutter on the
    // right the cap hugs the left edge of its box and detaches from its word.
    // The top nudge has to be per-letter because Playfair's round caps render
    // ~3px taller above the baseline than its flat-topped ones, so one shared
    // value leaves whichever letter it wasn't tuned for visibly off. jsdom
    // can't measure a pseudo-element, so this guards the class string only.
    const { container } = render(<StorySection />)

    const seen = new Set<string>()
    for (const panel of panels(container)) {
      const opener = panel.querySelector('p.first-letter\\:float-left')
      expect(opener, 'expected the opening paragraph to carry the drop cap').not.toBeNull()
      expect(opener!.className).toContain('first-letter:text-6xl')
      expect(opener!.className).toContain('first-letter:ml-[5px]')
      expect(opener!.className).toContain('first-letter:mr-[5px]')

      const letter = opener!.textContent!.trim()[0]
      const expected = { I: 'first-letter:mt-[1px]', O: 'first-letter:mt-[4px]' }[letter]
      expect(expected, `no measured offset for opening letter "${letter}"`).toBeDefined()
      expect(opener!.className).toContain(expected!)

      // globals.css corrects these offsets for Gecko off this attribute, so
      // losing it puts the cap 8px above the first line in Firefox only.
      expect(opener!.getAttribute('data-drop-cap')).toBe(letter)
      seen.add(letter)
    }
    expect(seen, 'expected the two accounts to open on different letters').toEqual(
      new Set(['I', 'O']),
    )
  })

  it('shows exactly one panel, matching the one selected tab', () => {
    const { container } = render(<StorySection />)

    const selected = tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true')
    expect(selected, 'expected exactly one selected tab').toHaveLength(1)

    const visible = panels(container).filter((panel) => !panel.hasAttribute('hidden'))
    expect(visible, 'expected exactly one visible panel').toHaveLength(1)
    expect(visible[0].id).toBe(selected[0].getAttribute('aria-controls'))
  })

  it('wires every tab to a panel that points back at it', () => {
    // The tab id, the panel id and the two aria references are written out in
    // four separate places, so they can drift apart silently.
    const { container } = render(<StorySection />)

    for (const tab of tabs()) {
      const panelId = tab.getAttribute('aria-controls')!
      const panel = container.querySelector(`#${panelId}`)
      expect(panel, `no panel with id "${panelId}" for tab "${tab.textContent}"`).not.toBeNull()
      expect(panel!.getAttribute('aria-labelledby')).toBe(tab.id)
    }
  })

  it('swaps the visible panel when the other tab is clicked', () => {
    const { container } = render(<StorySection />)

    const jackson = screen.getByRole('tab', { name: 'Jackson' })
    const anupama = screen.getByRole('tab', { name: 'Anupama' })
    fireEvent.click(jackson)

    expect(jackson).toHaveAttribute('aria-selected', 'true')
    expect(anupama).toHaveAttribute('aria-selected', 'false')

    const byId = Object.fromEntries(panels(container).map((p) => [p.id, p]))
    expect(byId['story-panel-jackson'].hasAttribute('hidden')).toBe(false)
    expect(byId['story-panel-anupama'].hasAttribute('hidden')).toBe(true)
  })

  it('moves selection with the arrow keys', () => {
    render(<StorySection />)

    fireEvent.keyDown(tablist(), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Jackson' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(tablist(), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Anupama' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps only the selected tab in the tab order', () => {
    // Roving tabindex: Tab reaches the tablist once, then the arrows move
    // within it. Two stops here would make the toggle a keyboard speed bump.
    render(<StorySection />)

    const reachable = tabs().filter((tab) => tab.getAttribute('tabindex') !== '-1')
    expect(reachable).toHaveLength(1)
    expect(reachable[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('gives every account a URL-safe, unique id', () => {
    const ids = storyAccounts.map((account) => account.id)
    for (const id of ids) expect(id, `"${id}" is not URL-safe`).toMatch(/^[a-z0-9-]+$/)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('describes every photo', () => {
    const { container } = render(<StorySection />)

    const images = [...container.querySelectorAll('img')]
    expect(images.length).toBeGreaterThan(0)
    for (const img of images) {
      expect(img.getAttribute('alt'), `${img.getAttribute('src')} has no alt text`).toBeTruthy()
    }
  })

  it('captions every photo, without repeating the alt text', () => {
    // The caption says where and when; the alt says what is in the frame. The
    // lightbox falls back to alt when a caption is missing, which is how alt
    // text ends up on screen — and "Moments after our engagement" tells someone
    // who can't see the photo nothing at all. Keep the two doing separate jobs.
    const photos = [
      ...storyAccounts.map((account) => account.photo),
      ...storyTravelPhotos,
      storyClosingPhoto,
    ]

    for (const photo of photos) {
      expect(photo.caption, `${photo.alt} has no caption`).toBeTruthy()
      expect(photo.caption, 'caption is just the alt text again').not.toBe(photo.alt)
    }
  })

  it('offers a webp for every photo, with a jpeg behind it', () => {
    const { container } = render(<StorySection />)

    const pictures = [...container.querySelectorAll('picture')]
    expect(pictures.length).toBe(container.querySelectorAll('img').length)
    for (const picture of pictures) {
      const source = picture.querySelector('source[type="image/webp"]')
      expect(source, 'picture without a webp source').not.toBeNull()
      expect(source!.getAttribute('srcSet') ?? source!.getAttribute('srcset')).toBeTruthy()
    }
  })

  it('makes every photo openable, including the one behind the inactive tab', () => {
    const { container } = render(<StorySection />)

    // Every photo is cropped by its container, so each one needs a way to see
    // the whole frame — the portrait in the hidden panel included.
    const figures = [...container.querySelectorAll('figure')]
    expect(figures.length).toBe(storyTravelPhotos.length + storyAccounts.length + 1)
    for (const figure of figures) {
      expect(
        figure.querySelector('button[aria-label^="View full size:"]'),
        `figure "${figure.textContent}" has no zoom trigger`,
      ).not.toBeNull()
    }
  })

  it('opens the full photo in a dialog and closes it again', () => {
    render(<StorySection />)

    expect(screen.queryByRole('dialog')).toBeNull()

    const trigger = screen.getByRole('button', { name: 'View full size: Norway' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // object-contain, not the grid's square crop: the whole frame is the point.
    expect(within(dialog).getByRole('img').className).toContain('object-contain')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Focus goes back to the thumbnail, or closing drops the reader at the top
    // of the document with no idea where they were.
    expect(document.activeElement).toBe(trigger)
  })

  it('closes the zoom on Escape', () => {
    render(<StorySection />)

    fireEvent.click(screen.getByRole('button', { name: 'View full size: Niagara Falls' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('heads the travel row with places the photos actually show', () => {
    // The heading used to echo Jackson's "the US, Europe, Africa, and India"
    // while the four photos under it were Norway and three US states. His
    // prose may say Africa — it's his sentence and it's true; the heading over
    // the pictures may not.
    render(<StorySection />)

    const captions = storyTravelPhotos.map((photo) => photo.caption)
    expect(captions).toEqual([
      'Norway',
      'Niagara Falls',
      'Atlanta Botanical Garden',
      'Monterey Bay Aquarium',
    ])

    const heading = screen.getByText(STORY_TRAVEL_HEADING)
    for (const absent of ['Africa', 'India', 'Europe']) {
      expect(heading.textContent, `heading still claims ${absent}`).not.toContain(absent)
    }
    // The ends of the row are what the heading names.
    expect(heading.textContent).toContain(captions[0])
    expect(heading.textContent).toContain('Monterey')
  })
})
