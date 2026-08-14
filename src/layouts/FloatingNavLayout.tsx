import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import FloatingNav from '../components/FloatingNav'

// Lets pages under this layout (e.g. Invite while zoomed on mobile) fade the
// floating nav out of the way.
export type FloatingNavOutletContext = {
  setNavHidden: (hidden: boolean) => void
}

const FloatingNavLayout: React.FC = () => {
  const [navHidden, setNavHidden] = useState(false)

  return (
    <>
      <FloatingNav hidden={navHidden} />
      <Outlet context={{ setNavHidden } satisfies FloatingNavOutletContext} />
    </>
  )
}

export default FloatingNavLayout
