import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ScheduleEventCard from './ScheduleEventCard'
import type { ScheduleEvent } from '../data/scheduleEvents'

const event = (overrides: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
  id: 'muhurtham',
  date: '2026-10-28',
  time: '9:00 AM to 11:30 AM',
  title: 'Wedding Ceremony & Muhurtham',
  location: 'Golkonda Resorts and Spa',
  sortKey: 10,
  ...overrides,
})

// The card is an <li>, so it needs a list around it — which means queries for
// the agenda list have to be scoped to the card itself, not the whole document.
const renderCard = (e: ScheduleEvent, dayVenue?: string) => {
  const { container } = render(
    <MemoryRouter>
      <ul>
        <ScheduleEventCard event={e} dayVenue={dayVenue} />
      </ul>
    </MemoryRouter>
  )
  return container.querySelector('li')!
}

describe('ScheduleEventCard', () => {
  it('always shows the title, time and venue', () => {
    renderCard(event())

    expect(
      screen.getByRole('heading', { name: 'Wedding Ceremony & Muhurtham' })
    ).toBeInTheDocument()
    expect(screen.getByText('9:00 AM to 11:30 AM')).toBeInTheDocument()
    expect(screen.getByText('Golkonda Resorts and Spa')).toBeInTheDocument()
  })

  it('links the venue to the map when there is one', () => {
    renderCard(event({ mapUrl: 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA' }))

    const link = screen.getByRole('link', { name: 'Golkonda Resorts and Spa' })
    expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('leaves the venue as plain text without a map url', () => {
    renderCard(event())

    expect(screen.getByText('Golkonda Resorts and Spa')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Golkonda Resorts and Spa' })).not.toBeInTheDocument()
  })

  it('drops the venue once the day heading already names it', () => {
    // Eight of the ten events are at the resort; repeating it on every card is
    // the noise this prop exists to remove.
    renderCard(event({ mapUrl: 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA' }), 'Golkonda Resorts and Spa')

    expect(screen.queryByText('Golkonda Resorts and Spa')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Golkonda Resorts and Spa' })).not.toBeInTheDocument()
  })

  it('keeps the venue when the event is somewhere other than the day heading', () => {
    // The Kerala trip shares October 29 with two events at the resort.
    renderCard(
      event({ location: 'Kochi & Alleppey, Kerala', mapUrl: 'https://example.com/kerala' }),
      'Golkonda Resorts and Spa'
    )

    expect(screen.getByRole('link', { name: 'Kochi & Alleppey, Kerala' })).toHaveAttribute(
      'href',
      'https://example.com/kerala'
    )
  })

  it('renders the run-of-show as a bullet list', () => {
    // Pellikuthuru's blocks. A flex column would suppress the markers, so this
    // checks they really are list items.
    const card = renderCard(
      event({ agenda: ['9:00 AM — Haldi', '10:30 AM — Mehendi', '12:00 PM — Lunch'] })
    )

    const list = within(card).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('10:30 AM — Mehendi')).toBeInTheDocument()
  })

  it('renders no agenda list when there is nothing to list', () => {
    const card = renderCard(event({ agenda: [] }))

    expect(within(card).queryByRole('list')).not.toBeInTheDocument()
  })

  it('names the hanger icon for screen readers, which see no image', () => {
    const card = renderCard(event({ attire: 'Saris and kurtas encouraged' }))

    expect(screen.getByText('Attire:')).toBeInTheDocument()
    expect(screen.getByText(/Saris and kurtas encouraged/)).toBeInTheDocument()
    expect(card.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('sends a reader to the guide only where it has something to say', () => {
    // Most events carry an attire line; only four have Indian-wear notes. A
    // link on every card would put the same one on most of the page.
    const withNotes = renderCard(
      event({
        attire: 'Saris and kurtas encouraged',
        indianWear: { women: 'Bright saris', men: 'A kurta or kurta pajama set' },
      })
    )
    // Deep-linked to this event's own anchor in the guide's dress-code list,
    // not to the top of the section — the fixture's id is 'muhurtham'.
    const link = within(withNotes).getByRole('link', { name: 'What to Wear Guide' })
    expect(link).toHaveAttribute('href', '/what-to-wear#muhurtham')

    const plain = renderCard(event({ attire: 'Casual' }))
    expect(within(plain).queryByRole('link', { name: 'What to Wear Guide' })).toBeNull()
  })

  it('shows the description and the trailing note', () => {
    renderCard(
      event({
        description: 'The sacred wedding ceremony.',
        note: 'Come whenever you can.',
      })
    )

    expect(screen.getByText('The sacred wedding ceremony.')).toBeInTheDocument()
    expect(screen.getByText('Come whenever you can.')).toBeInTheDocument()
  })

  it('omits the optional blocks entirely when the event has none', () => {
    renderCard(event())

    expect(screen.queryByText('Attire:')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('links onward for events that mostly point elsewhere', () => {
    renderCard(event({ linkTo: '/kerala-itinerary', linkLabel: 'See the itinerary' }))

    expect(screen.getByRole('link', { name: 'See the itinerary' })).toHaveAttribute(
      'href',
      '/kerala-itinerary'
    )
  })

  it('falls back to a generic label for an onward link', () => {
    renderCard(event({ linkTo: '/kerala-itinerary' }))

    expect(screen.getByRole('link', { name: 'Read more' })).toBeInTheDocument()
  })
})
