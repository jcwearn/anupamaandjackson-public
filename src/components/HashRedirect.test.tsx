import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import HashRedirect from './HashRedirect'

const ShowLocation = () => {
  const { pathname, hash } = useLocation()
  return <p>{`${pathname}${hash}`}</p>
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/travel-tips" element={<HashRedirect to="/travel/tips" />} />
        <Route path="/travel/tips" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>
  )

describe('HashRedirect', () => {
  // Deep links to /travel-tips#… were shared before the page moved. A plain
  // <Navigate> would drop the fragment and strand the reader at the top.
  it('carries the fragment across to the new path', () => {
    renderAt('/travel-tips#what-to-pack')

    expect(screen.getByText('/travel/tips#what-to-pack')).toBeInTheDocument()
  })

  it('redirects a bare path with no fragment', () => {
    renderAt('/travel-tips')

    expect(screen.getByText('/travel/tips')).toBeInTheDocument()
  })
})
