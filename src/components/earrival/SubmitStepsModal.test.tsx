import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubmitStepsModal from './SubmitStepsModal'

const PORTAL = 'https://indianvisaonline.gov.in/earrival/'

const dialog = () => screen.getByRole('dialog', { name: /What happens when you submit/ })

describe('SubmitStepsModal', () => {
  it('repeats the three submit steps', () => {
    render(<SubmitStepsModal open onClose={() => {}} portalUrl={PORTAL} />)

    expect(dialog()).toHaveTextContent('don’t press Submit again')
    expect(dialog()).toHaveTextContent('Arrival Card generated successfully')
    expect(dialog()).toHaveTextContent('downloads the card(s)')
  })

  it('opens the portal in a new tab and closes itself', () => {
    const onClose = vi.fn()
    render(<SubmitStepsModal open onClose={onClose} portalUrl={PORTAL} />)

    const go = screen.getByRole('link', { name: /open the portal/ })
    expect(go).toHaveAttribute('href', PORTAL)
    expect(go).toHaveAttribute('target', '_blank')
    fireEvent.click(go)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape, the backdrop, the close button and "Not yet"', () => {
    const onClose = vi.fn()
    const { container } = render(<SubmitStepsModal open onClose={onClose} portalUrl={PORTAL} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }))
    fireEvent.click(container.querySelector('.animate-backdrop-fade-in')!)
    expect(onClose).toHaveBeenCalledTimes(4)
  })

  it('renders nothing while closed', () => {
    // A view transition morphs the page's card into this panel by moving a
    // shared name from one to the other, so the panel can't sit in the DOM
    // hidden while the card holds that name too.
    const { container } = render(
      <SubmitStepsModal open={false} onClose={() => {}} portalUrl={PORTAL} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
