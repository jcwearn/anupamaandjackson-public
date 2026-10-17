import { describe, expect, it } from 'vitest'
import { BED_LABEL, nightsCount, nightsRange, roommatesLabel } from './golkondaStay'

describe('golkondaStay wording', () => {
  it('names every bed the lookup can return', () => {
    expect(BED_LABEL).toEqual({
      king: 'King',
      twin: 'Twin beds',
      'king-extra': 'King + extra bed',
      'king-sofa': 'King + sofa bed',
      villa: 'Villa',
    })
  })

  it('lists roommates the way a sentence would', () => {
    expect(roommatesLabel([])).toBe('a room of your own')
    expect(roommatesLabel(['Ada Lovelace'])).toBe('with Ada Lovelace')
    expect(roommatesLabel(['Ada Lovelace', 'Grace Hopper'])).toBe(
      'with Ada Lovelace and Grace Hopper',
    )
    expect(roommatesLabel(['Vera Rubin', 'Carl Sagan', 'Enrico Fermi'])).toBe(
      'with Vera Rubin, Carl Sagan and Enrico Fermi',
    )
  })

  it('writes the nights as a range, across a month end too', () => {
    expect(nightsRange('2026-10-27', '2026-10-29')).toBe('Oct 27 – 29')
    expect(nightsRange('2026-10-30', '2026-11-01')).toBe('Oct 30 – Nov 1')
  })

  it('counts nights, singular included', () => {
    expect(nightsCount('2026-10-27', '2026-10-29')).toBe('2 nights')
    expect(nightsCount('2026-10-28', '2026-10-29')).toBe('1 night')
  })
})
