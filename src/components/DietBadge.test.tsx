import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DietBadge from './DietBadge'
import type { Diet } from '../data/eats'

const renderBadge = (diet: Diet) => render(<DietBadge diet={diet} />)

describe('DietBadge', () => {
  it('names the diet in text, not only in the icon', () => {
    // The icons are aria-hidden, so the word is the whole accessible name. An
    // icon-only badge would say nothing at all to a screen reader.
    for (const [diet, label] of [
      ['vegan', 'Vegan'],
      ['veg', 'Veg'],
      ['non-veg', 'Non-veg'],
    ] as const) {
      const { container, unmount } = renderBadge(diet)

      expect(container.textContent?.trim()).toBe(label)
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      unmount()
    }
  })

  it('draws the leaf for vegan, the circle for veg and the triangle for non-veg', () => {
    // The point of the feature. Labels alone would still read correctly if the
    // icon lookup were scrambled, so pin the shapes. Circle and triangle are also
    // what separates the two marks from each other — India's older non-veg mark
    // was a circle in a brown square, so a non-veg badge drawing a circle is the
    // superseded mark rather than a harmless variation.
    const vegan = renderBadge('vegan')
    expect(vegan.container.querySelector('circle'), 'vegan should not draw a dot').toBeNull()
    expect(vegan.container.querySelectorAll('path').length).toBeGreaterThan(0)
    vegan.unmount()

    const veg = renderBadge('veg')
    expect(veg.container.querySelector('circle'), 'veg should draw a dot').not.toBeNull()
    expect(veg.container.querySelector('rect'), 'veg should draw its square').not.toBeNull()
    veg.unmount()

    const nonVeg = renderBadge('non-veg')
    expect(nonVeg.container.querySelector('circle'), 'non-veg should not draw a dot').toBeNull()
    expect(nonVeg.container.querySelector('path'), 'non-veg should draw a triangle').not.toBeNull()
    expect(nonVeg.container.querySelector('rect'), 'non-veg should draw its square').not.toBeNull()
  })

  it('greens the two vegetarian marks and browns the non-veg one', () => {
    // Colour is doing real work here — it is how the marks read at a glance
    // before the word is read, and these are FSSAI's own two colours rather than
    // the site's, so they match the menu a guest is holding.
    const green = ['vegan', 'veg'] as const
    for (const diet of green) {
      const { container, unmount } = renderBadge(diet)
      expect(container.firstElementChild!.className).toContain('text-fssai-green')
      unmount()
    }

    const { container } = renderBadge('non-veg')
    expect(container.firstElementChild!.className).toContain('text-fssai-brown')
    expect(container.firstElementChild!.className).not.toContain('text-fssai-green')
  })

  it('takes extra classes without dropping its own', () => {
    render(<DietBadge diet="veg" className="mt-2" />)

    const badge = screen.getByText('Veg')
    expect(badge.className).toContain('mt-2')
    expect(badge.className).toContain('text-fssai-green')
  })
})
