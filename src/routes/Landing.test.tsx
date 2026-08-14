import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import Landing from './Landing'

describe('Landing', () => {
  it('carries the story section, with its anchor intact', () => {
    // #our-story is a hand-written anchor, so it is shareable and must survive
    // any rewording of the heading above it.
    const { container } = render(<Landing />)

    const story = container.querySelector<HTMLElement>('#our-story')
    expect(story, 'no #our-story section on the landing page').not.toBeNull()
    expect(within(story!).getByRole('tablist')).toBeInTheDocument()
  })

  it('still leads with the RSVP call to action', () => {
    // The story goes below the invitation card; it must not have displaced the
    // one thing the page is actually for.
    const { container } = render(<Landing />)

    const button = container.querySelector('button[aria-haspopup="dialog"]')
    expect(button?.textContent).toContain('RSVP on Joy')

    const story = container.querySelector('#our-story')!
    expect(
      button!.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the story should come after the RSVP button, not before it'
    ).toBeTruthy()
  })
})
