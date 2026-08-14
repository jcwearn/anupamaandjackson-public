import React from 'react'
import Container from '../components/Container'
import { events } from '../data/events'
import EventCard from '../components/EventCard'

const Schedule: React.FC = () => {
  return (
    <>
      <header className="bg-peach/60 py-16 text-center">
        <h1 className="text-4xl">Schedule</h1>
        <p className="mt-2 text-zeus/80">Saturday, August 16, 2025 – Atlanta, GA</p>
      </header>
      <Container width="md" className="mt-12">
        <ol className="space-y-4">
          {events.map((e) => (
            <EventCard key={e.title} event={e} />
          ))}
        </ol>
      </Container>
    </>
  )
}

export default Schedule
