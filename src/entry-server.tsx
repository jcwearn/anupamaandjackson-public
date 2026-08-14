import React from 'react'
import { renderToString } from 'react-dom/server'
// All from react-router-dom, which re-exports StaticRouter: pulling it from
// react-router instead resolves to a second copy of the module under vitest, so
// the router's context and Routes' consumer of it no longer match.
import { StaticRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import HashRedirect from './components/HashRedirect'

export function render(url: string) {
  const html = renderToString(
    <StaticRouter location={url}>
      <Routes>
        <Route path="/engagement" element={<App />}>
          <Route index element={<Home />} />
          <Route path="schedule" element={<Schedule />} />
        </Route>
        <Route element={<FloatingNavLayout />}>
          <Route path="/save-the-date" element={<SaveTheDateEnvelope />} />
          <Route path="/invites/wearn" element={<Invite variant="wearn" />} />
          <Route path="/invites/tadanki" element={<Invite variant="tadanki" />} />
          <Route path="/invites/tadanki/reception" element={<Invite variant="tadanki-reception" />} />
          <Route path="/invites/tadanki/muhurtham" element={<Invite variant="tadanki-muhurtham" />} />
        </Route>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/schedule" element={<WeddingSchedule />} />
          <Route path="/evisa" element={<Evisa />} />
          <Route path="/kerala-itinerary" element={<KeralaItinerary />} />
          <Route path="/hotels" element={<Hotels />} />
          <Route path="/invites/links" element={<InviteLinks />} />
          <Route element={<TravelLayout />}>
            <Route path="/travel" element={<Travel />} />
            <Route path="/travel/hyderabad" element={<Hyderabad />} />
            <Route path="/travel/food" element={<Food />} />
            <Route path="/travel/tips" element={<TravelTips />} />
          </Route>
          <Route path="/faq" element={<Faq />} />
          <Route path="/what-to-wear" element={<WhatToWear />} />
          <Route path="/bookshelf" element={<Bookshelf />} />
          <Route path="/travel-tips" element={<HashRedirect to="/travel/tips" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StaticRouter>
  )
  return html
}
