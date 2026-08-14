import React from 'react'
import { useLocation } from 'react-router-dom'

// A heading inside a closed <details> isn't rendered, so the browser's own
// fragment scroll can't reach it — open the target and every <details> above it
// (a question is nested inside its group) before scrolling.
const revealHashTarget = (hash: string, behavior: ScrollBehavior) => {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  if (!id) return
  const target = document.getElementById(id)
  if (!target) return

  let el: Element | null = target
  while (el) {
    // Annotated because inferring it would cycle: narrowing `el` in this loop
    // depends on the reassignment below, which depends on this type.
    const details: HTMLDetailsElement | null = el.closest('details')
    if (!details) break
    details.open = true
    el = details.parentElement
  }

  // Opening the disclosures reflows the page; scroll on the next frame so the
  // target has settled at its final offset.
  requestAnimationFrame(() => target.scrollIntoView({ behavior, block: 'start' }))
}

// Lands a deep link on a page built from nested <details>: opens the ancestors
// of whatever the hash names and scrolls it under the fixed SiteNav.
export function useHashDisclosure() {
  const { hash } = useLocation()
  const isFirstReveal = React.useRef(true)

  React.useEffect(() => {
    // Arriving on a deep link should land already scrolled; globals.css sets
    // scroll-behavior: smooth, so opt out of the animation on that first pass.
    const behavior = isFirstReveal.current ? 'instant' : 'smooth'
    isFirstReveal.current = false
    revealHashTarget(hash, behavior)
  }, [hash])

  // Editing just the hash in the address bar fires hashchange but no popstate,
  // so react-router's location never updates and the effect above won't run.
  React.useEffect(() => {
    const onHashChange = () => revealHashTarget(window.location.hash, 'smooth')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
}
