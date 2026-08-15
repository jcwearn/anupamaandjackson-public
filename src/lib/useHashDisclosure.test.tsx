import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Disclosure, DisclosureGroup } from '../components/Disclosure'
import { useHashDisclosure } from './useHashDisclosure'

const scrollIntoView = vi.fn()

beforeAll(() => {
  // The reveal scrolls on the next frame, so the disclosures have reflowed
  // first; run it inline so the assertion doesn't have to wait for a frame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  // jsdom implements neither, and the hook calls both.
  Element.prototype.scrollIntoView = scrollIntoView
})

// A question nested inside a group — the shape both /travel-tips and /faq use,
// and the reason the hook walks up the tree rather than opening one <details>.
const Page: React.FC = () => {
  useHashDisclosure()

  return (
    <DisclosureGroup id="traveling-to-india" title="Traveling to India" blurb="The short answers.">
      <Disclosure id="passport-validity" title="Does my passport need to be valid?">
        <p>At least six months.</p>
      </Disclosure>
    </DisclosureGroup>
  )
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Page />
    </MemoryRouter>,
  )

describe('useHashDisclosure', () => {
  it('opens every disclosure above the deep-linked one', () => {
    const { container } = renderAt('/faq#passport-validity')

    expect(container.querySelector<HTMLDetailsElement>('#passport-validity')!.open).toBe(true)
    // The group too: a closed ancestor would leave the question unrendered and
    // the browser's own fragment scroll with nothing to reach.
    expect(container.querySelector<HTMLDetailsElement>('#traveling-to-india')!.open).toBe(true)
  })

  it('scrolls the deep-linked target into view', () => {
    scrollIntoView.mockClear()
    renderAt('/faq#passport-validity')

    // Instant on arrival: the reader asked for this position rather than
    // scrolling to it, and globals.css would otherwise animate the whole way.
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' })
  })

  it('leaves everything closed with no hash', () => {
    const { container } = renderAt('/faq')

    expect(container.querySelector<HTMLDetailsElement>('#traveling-to-india')!.open).toBe(false)
    expect(container.querySelector<HTMLDetailsElement>('#passport-validity')!.open).toBe(false)
  })

  it('ignores a hash naming nothing on the page', () => {
    scrollIntoView.mockClear()
    const { container } = renderAt('/faq#not-a-question')

    expect(container.querySelector<HTMLDetailsElement>('#traveling-to-india')!.open).toBe(false)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('reveals on a bare hashchange, which fires no popstate', () => {
    const { container } = renderAt('/faq')

    // Editing the fragment in the address bar doesn't update react-router's
    // location, so the hash effect alone would never see it.
    act(() => {
      window.location.hash = '#passport-validity'
      window.dispatchEvent(new Event('hashchange'))
    })

    expect(container.querySelector<HTMLDetailsElement>('#passport-validity')!.open).toBe(true)
  })
})
