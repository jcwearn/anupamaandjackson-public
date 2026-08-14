import React from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import App from './App'
import Home from './routes/Home'
import Schedule from './routes/Schedule'
import SaveTheDateEnvelope from './routes/SaveTheDateEnvelope'
import Invite from './routes/Invite'
import InviteLinks from './routes/InviteLinks'
import Landing from './routes/Landing'
import Evisa from './routes/Evisa'
import KeralaItinerary from './routes/KeralaItinerary'
import Hotels from './routes/Hotels'
import Travel from './routes/Travel'
import Food from './routes/Food'
import Hyderabad from './routes/Hyderabad'
import TravelTips from './routes/TravelTips'
import Faq from './routes/Faq'
import Bookshelf from './routes/Bookshelf'
import WhatToWear from './routes/WhatToWear'
import WeddingSchedule from './routes/WeddingSchedule'
import SiteLayout from './layouts/SiteLayout'
import TravelLayout from './layouts/TravelLayout'
import FloatingNavLayout from './layouts/FloatingNavLayout'
import ScrollToTop from './components/ScrollToTop'
import HashRedirect from './components/HashRedirect'
import './styles/globals.css'

const router = createBrowserRouter([
  // Client-only root wrapper: resets scroll on navigation. Not mirrored in
  // entry-server.tsx, which has no window to scroll.
  {
    element: (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      // Engagement section with nested routes
      {
        path: '/engagement',
        element: <App />,
        children: [
          { index: true, element: <Home /> },
          { path: 'schedule', element: <Schedule /> },
        ],
      },

      // Invites and save-the-date, with the collapsed floating nav (Invite.tsx
      // owns a full-viewport dvh-based layout).
      {
        element: <FloatingNavLayout />,
        children: [
          { path: '/save-the-date', element: <SaveTheDateEnvelope /> },
          { path: '/invites/wearn', element: <Invite variant="wearn" /> },
          { path: '/invites/tadanki', element: <Invite variant="tadanki" /> },
          { path: '/invites/tadanki/reception', element: <Invite variant="tadanki-reception" /> },
          { path: '/invites/tadanki/muhurtham', element: <Invite variant="tadanki-muhurtham" /> },
        ],
      },

      // Landing page and standalone wedding pages, with the always-visible site nav.
      {
        element: <SiteLayout />,
        children: [
          { path: '/', element: <Landing /> },
          { path: '/schedule', element: <WeddingSchedule /> },
          { path: '/evisa', element: <Evisa /> },
          { path: '/kerala-itinerary', element: <KeralaItinerary /> },
          { path: '/hotels', element: <Hotels /> },

          // Unlinked and gated on the `admin` tag. Under SiteLayout rather than
          // FloatingNavLayout because only SiteLayout mounts the provider the
          // gate reads — the invite pages themselves have no guest state.
          { path: '/invites/links', element: <InviteLinks /> },

          // Nested so the Travel pages share a second-level nav bar under SiteNav.
          {
            element: <TravelLayout />,
            children: [
              { path: '/travel', element: <Travel /> },
              { path: '/travel/hyderabad', element: <Hyderabad /> },
              { path: '/travel/food', element: <Food /> },
              { path: '/travel/tips', element: <TravelTips /> },
            ],
          },

          { path: '/faq', element: <Faq /> },

          // Not in NAV_ITEMS — the row is at its measured width limit, and the
          // FAQ's What to Wear section is where someone asking this question
          // already is. Reached from there and from Travel Tips' Outfits tip.
          { path: '/what-to-wear', element: <WhatToWear /> },

          { path: '/bookshelf', element: <Bookshelf /> },

          // Tips used to live at /travel-tips and those links are already out in
          // the world. public/_redirects handles hard navigations; this covers
          // anything routed client-side.
          { path: '/travel-tips', element: <HashRedirect to="/travel/tips" /> },
        ],
      },

      // 404 catch-all redirects to the landing page
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

const rootElement = document.getElementById('root')!
const app = <RouterProvider router={router} />

// Use hydration if the page was prerendered (has SSR content)
if (rootElement.innerHTML.trim()) {
  hydrateRoot(rootElement, app)
} else {
  createRoot(rootElement).render(app)
}
