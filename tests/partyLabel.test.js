import { describe, expect, it } from 'vitest'
import { partyHintLabel } from '../scripts/lib/partyLabel.js'

const guest = (row, firstName, lastName, envelopeName = `${firstName} ${lastName}`.trim()) => ({
  row,
  firstName,
  lastName,
  envelopeName,
})

describe('partyHintLabel', () => {
  const vidya = guest(1, 'Vidya', 'Tadanki')

  it('names the one other member of the party', () => {
    expect(partyHintLabel(vidya, [vidya, guest(2, 'Anirudh', 'Tadanki')])).toBe(
      'With Anirudh Tadanki',
    )
  })

  it('collapses a shared surname across several members', () => {
    const party = [vidya, guest(2, 'Venkat', 'Tadanki'), guest(3, 'Aditya', 'Tadanki')]
    expect(partyHintLabel(vidya, party)).toBe('With Venkat & Aditya Tadanki')
  })

  it('keeps full names when surnames differ', () => {
    const party = [vidya, guest(2, 'Anuradha', 'Vadrevu'), guest(3, 'Ram', 'Prayaga')]
    expect(partyHintLabel(vidya, party)).toBe('With Anuradha Vadrevu & Ram Prayaga')
  })

  it('caps long parties rather than listing everyone', () => {
    const party = [
      vidya,
      guest(2, 'Anu', 'Atta'),
      guest(3, 'Ben', 'Brar'),
      guest(4, 'Che', 'Chava'),
      guest(5, 'Dee', 'Duvvuri'),
    ]
    expect(partyHintLabel(vidya, party)).toBe('With Anu Atta, Ben Brar, Che Chava & others')
  })

  it('leaves plus-one placeholder rows out of the named list', () => {
    const party = [vidya, guest(2, 'Anuradha', 'Vadrevu'), guest(3, "Srikrishna's Guest", '')]
    expect(partyHintLabel(vidya, party)).toBe('With Anuradha Vadrevu')
  })

  it('still says something when the party is only placeholders', () => {
    expect(partyHintLabel(vidya, [vidya, guest(2, "Vidya's Guest", '')])).toBe('With a guest')
    expect(
      partyHintLabel(vidya, [vidya, guest(2, "Vidya's Guest", ''), guest(3, 'Guest', 'Two')]),
    ).toBe('With guests')
  })

  it('falls back to a distinct envelope name for a solo party', () => {
    const solo = guest(1, 'Ram', 'Prayaga', 'The Prayaga Family')
    expect(partyHintLabel(solo, [solo])).toBe('Invited as The Prayaga Family')
  })

  it('returns nothing when the envelope name adds nothing', () => {
    const solo = guest(1, 'Ram', 'Prayaga')
    expect(partyHintLabel(solo, [solo])).toBe('')
    expect(partyHintLabel(solo, [])).toBe('')
    expect(partyHintLabel(solo, undefined)).toBe('')
  })
})
