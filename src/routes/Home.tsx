import React from 'react'
import Celebration from '../components/Celebration'
import Container from '../components/Container'
import heroSrc from '../assets/sangeet.jpg'

const eventDate = new Date('2025-08-16T09:30:00-04:00')

const Home: React.FC = () => {
  return (
    <>
      <section className="relative isolate">
        <img
          src={heroSrc}
          alt="Anupama and Jackson smiling together in front of a pink arch backdrop"
          className="h-[60vh] w-full object-cover object-center sm:h-[70vh]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-peach/90 via-peach/40 to-transparent" />
        <div className="absolute inset-0 flex items-end justify-center pb-12 text-center">
          <div className="px-4">
            <h1 className="text-4xl sm:text-6xl font-display text-rosewood drop-shadow-md">
              Anupama & Jackson
            </h1>
            <p className="mt-4 text-xl sm:text-2xl text-zeus drop-shadow">
              Saturday • August 16 • 2025
            </p>
            <p className="text-lg text-zeus/90">Atlanta, Georgia</p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <Container className="text-center">
          <h2 className="text-2xl sm:text-3xl">Join Anupama & Jackson in Atlanta for their engagement weekend.</h2>
          <Celebration className="mt-4 text-2xl font-mono tracking-wider" />
        </Container>
      </section>

      <section className="mt-16 text-center">
        <Container>
          <a href="/engagement/schedule" className="btn-primary">
            See the Day's Schedule
          </a>
        </Container>
      </section>
    </>
  )
}

export default Home
