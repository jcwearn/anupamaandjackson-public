import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

// A <Navigate> that carries the fragment across with it. Plain <Navigate to="/x" />
// drops the hash, which would strand anyone following an old deep link
// (/travel-tips#what-to-pack) at the top of the new page.
const HashRedirect: React.FC<{ to: string }> = ({ to }) => {
  const { hash } = useLocation()
  return <Navigate to={`${to}${hash}`} replace />
}

export default HashRedirect
