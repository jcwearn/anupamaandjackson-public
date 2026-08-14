import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

const App: React.FC = () => {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export default App
