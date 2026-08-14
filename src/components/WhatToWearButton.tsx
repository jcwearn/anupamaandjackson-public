import React from 'react'
import { Link } from 'react-router-dom'

/**
 * The way in to /what-to-wear from everywhere that used to answer part of the
 * clothing question itself — a schedule card's dress code, the FAQ, Travel Tips.
 *
 * Outlined rather than `.btn-primary`: on the schedule it sits a few rows above
 * the Kerala card's solid button, and two of those at equal weight argue about
 * which is the page's call to action. This one is an aside.
 */
const WhatToWearButton: React.FC<{
  /** Deep-links to one event's notes, e.g. `muhurtham`. */
  eventId?: string
  label?: string
  className?: string
}> = ({ eventId, label = 'What to Wear Guide', className = '' }) => (
  <Link
    to={eventId ? `/what-to-wear#${eventId}` : '/what-to-wear'}
    className={`inline-block rounded-full border border-gold/70 px-4 py-1.5 font-body text-sm font-medium text-rosewood transition-colors duration-150 hover:bg-gold hover:text-buccaneer ${className}`}
  >
    {label}
  </Link>
)

export default WhatToWearButton
