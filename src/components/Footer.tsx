import React from 'react'
import Container from './Container'

const Footer: React.FC = () => {
  return (
    <footer className="mt-24 bg-peach/40 py-8 text-center text-sm text-soyabean">
      <Container>
        <p>© {new Date().getFullYear()} Anupama & Jackson. Built with ❤️ in Atlanta.</p>
      </Container>
    </footer>
  )
}

export default Footer
