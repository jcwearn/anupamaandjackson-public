import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CopyField from './CopyField'

// jsdom has no clipboard API, so stand one up and spy on it — same as
// CopyLinkButton.test.tsx.
const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CopyField', () => {
  it('copies the value, not a link to the page', () => {
    // The distinction from CopyLinkButton: these boxes exist to get a value onto
    // the portal's form, so the value itself is what has to land on the clipboard.
    render(<CopyField label="State" value="TELANGANA" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy State' }))

    expect(writeText).toHaveBeenCalledWith('TELANGANA')
  })

  it('confirms the copy, then resets itself', () => {
    vi.useFakeTimers()
    render(<CopyField label="State" value="TELANGANA" />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'State copied')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy State')
  })

  it('renders the value when no display override is given', () => {
    render(<CopyField label="State" value="TELANGANA" />)

    expect(screen.getByText('TELANGANA')).toBeInTheDocument()
  })

  it('copies `value` while rendering `children`, when the two differ', () => {
    // The reference phone number renders its punctuation and copies only digits.
    render(
      <CopyField label="Phone No/Mobile No" value="9104035010101">
        <span>91</span>
      </CopyField>,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(writeText).toHaveBeenCalledWith('9104035010101')
    expect(screen.queryByText('9104035010101')).not.toBeInTheDocument()
  })

  it('shows the hint when there is one', () => {
    render(<CopyField label="State" value="TELANGANA" hint="Pick from the dropdown." />)

    expect(screen.getByText('Pick from the dropdown.')).toBeInTheDocument()
  })

  it('puts the button on the value’s line, not the label’s', () => {
    // It copies the value, so it has to read as belonging to it — level with the
    // label it looked like a stray corner icon.
    render(<CopyField label="State" value="TELANGANA" hint="Pick from the dropdown." />)

    const row = screen.getByRole('button').parentElement!
    expect(row.className).toContain('items-center')
    expect(row.textContent).toBe('TELANGANA')
  })

  it('keeps the button visible rather than revealing it on hover', () => {
    // Unlike CopyLinkButton, copying is the point of this box — not an extra —
    // and there is nothing to hover on a phone.
    render(<CopyField label="State" value="TELANGANA" />)

    expect(screen.getByRole('button').className).not.toContain('opacity-0')
  })
})
