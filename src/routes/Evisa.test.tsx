import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import Evisa from './Evisa'
import { NAV_ITEMS } from '../lib/navItems'
import { JUMP_NAV_SCROLL_MT } from '../components/JumpNav'

beforeAll(() => {
  // StickySectionHeading pins itself with an IntersectionObserver, absent in jsdom.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

const sectionIds = ['what-youll-need', 'your-photos', 'the-application']

describe('Evisa', () => {
  it('every in-page jump link points at an element that exists', () => {
    // The chip labels, the section ids and the headings' anchorIds are written
    // out in three separate places, so they can drift apart silently.
    const { container } = render(<Evisa />)

    const hrefs = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')!.slice(1),
    )

    expect(hrefs.length).toBeGreaterThan(0)
    for (const id of hrefs) {
      expect(container.querySelector(`#${id}`), `no element with id "${id}"`).not.toBeNull()
    }
  })

  it('reaches all three sections from the pinned jump bar', () => {
    render(<Evisa />)

    const bar = screen.getByRole('navigation', { name: 'Jump to section' })
    for (const [label, id] of [
      ['What you’ll need', 'what-youll-need'],
      ['Your photos', 'your-photos'],
      ['The application', 'the-application'],
    ]) {
      expect(within(bar).getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`)
    }
  })

  it('clears both bars when a section is jumped to', () => {
    // Without the larger scroll-mt these land behind the jump bar rather than
    // below it. Tailwind needs the class spelled out, so it is easy to omit.
    const { container } = render(<Evisa />)

    for (const id of sectionIds) {
      expect(container.querySelector(`#${id}`)!.className).toContain(JUMP_NAV_SCROLL_MT)
    }
  })

  it('gives each section heading a copy button matching its section id', () => {
    const { container } = render(<Evisa />)

    for (const [id, title] of [
      ['what-youll-need', 'What you’ll need'],
      ['your-photos', 'Your photos'],
      ['the-application', 'The application'],
    ]) {
      const button = container.querySelector(`#${id} button[aria-label="Copy link to ${title}"]`)
      expect(button, `no copy button for #${id}`).not.toBeNull()
    }
  })

  it('puts the file converters in their own section, not inside the checklist', () => {
    // They are the most useful thing on the page and used to sit two levels deep
    // inside one of six checklist cards.
    const { container } = render(<Evisa />)

    const photos = container.querySelector('#your-photos')!
    expect(within(photos as HTMLElement).getAllByText(/Choose a file/)).toHaveLength(2)
    expect(container.querySelector('#what-youll-need')!.textContent).not.toContain('Choose a file')
  })

  it('keeps the reference phone number as digits only in the DOM', () => {
    // The +, parentheses, space and dash are CSS pseudo-elements precisely so a
    // copy — from the button or from select-all — picks up only the digits.
    const { container } = render(<Evisa />)

    const phone = container.querySelector('#what-youll-need')!.textContent!
    expect(phone).toContain('9104035010101')
    expect(phone).not.toContain('+91')
  })

  it('copies a reference field value rather than a link to the page', () => {
    render(<Evisa />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy Reference Name in India' }))

    expect(writeText).toHaveBeenCalledWith('The Golkonda Resorts and Spas')
  })

  it('copies the phone number as the digits the form wants', () => {
    render(<Evisa />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy Phone No/Mobile No' }))

    expect(writeText).toHaveBeenCalledWith('9104035010101')
  })

  it('numbers every step of the walkthrough', () => {
    const { container } = render(<Evisa />)

    const steps = container.querySelectorAll('#the-application ol > li')
    expect(steps.length).toBeGreaterThan(0)
    steps.forEach((step, i) => {
      expect(step.textContent).toContain(String(i + 1))
    })
  })

  it('draws the timeline rail between steps but not after the last one', () => {
    const { container } = render(<Evisa />)

    const steps = container.querySelectorAll('#the-application ol > li')
    const rails = container.querySelectorAll('#the-application ol > li [data-step-rail]')
    expect(rails).toHaveLength(steps.length - 1)
  })

  it('spells it e-Visa, the way the Indian government does', () => {
    const { container } = render(<Evisa />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('India e-Visa Helper')
    // The one exception: "Apply here for e-visa" quotes the portal's own button.
    const text = container.textContent!.replace('Apply here for e-visa', '')
    expect(text).not.toMatch(/eVisa/)
  })

  it('links the page from the site nav under the government spelling', () => {
    expect(NAV_ITEMS).toContainEqual({ to: '/evisa', label: 'e-Visa' })
  })
})
