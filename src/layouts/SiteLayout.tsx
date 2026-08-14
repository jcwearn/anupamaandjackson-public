import React from 'react'
import { Outlet } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { SITE_MAIN_PADDING_TOP } from '../lib/constants'

// The provider wraps the nav as well as the page: SiteNav's guest badge and the
// pages' gated sections have to agree about who's signed in, and this layout is
// the one place both live. It's shared by main.tsx and entry-server.tsx, so
// prerendering picks it up without a second route table to keep in step.
const SiteLayout: React.FC = () => (
  <GuestScheduleProvider>
    <SiteNav />
    <main style={{ paddingTop: SITE_MAIN_PADDING_TOP }}>
      <Outlet />
    </main>
  </GuestScheduleProvider>
)

export default SiteLayout
