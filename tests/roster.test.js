import { describe, expect, it } from 'vitest'
import { parseCsv, parseEmails, rowsToGuests } from '../scripts/lib/roster.js'

const HEADER = 'first name,last name,envelope name,party,muhurtam (tag),sangeet (tag)'

describe('parseCsv', () => {
  it('keeps commas inside quoted fields', () => {
    // Real names on this list contain them: 'Subba Rao, Jr.'
    expect(parseCsv('a,"Subba Rao, Jr.",c')).toEqual([['a', 'Subba Rao, Jr.', 'c']])
  })

  it('unescapes a doubled quote', () => {
    expect(parseCsv('a,"She said ""hi""",c')).toEqual([['a', 'She said "hi"', 'c']])
  })

  it('reads CRLF and LF line endings the same way', () => {
    const rows = [
      ['first name', 'last name'],
      ['Ada', 'Lovelace'],
    ]

    expect(parseCsv('first name,last name\r\nAda,Lovelace')).toEqual(rows)
    expect(parseCsv('first name,last name\nAda,Lovelace')).toEqual(rows)
  })

  it('keeps a newline that falls inside a quoted field', () => {
    expect(parseCsv('a,"line one\nline two"')).toEqual([['a', 'line one\nline two']])
  })

  it('preserves empty fields rather than dropping them', () => {
    // Column position is what the tag lookup depends on.
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })

  it('does not emit a trailing empty row for a trailing newline', () => {
    expect(parseCsv('a,b\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('rowsToGuests', () => {
  const guestsFrom = (csv) => rowsToGuests(parseCsv(csv))

  it('reads a guest and the tags they carry', () => {
    const [guest] = guestsFrom(`${HEADER}\nAda,Lovelace,Ada Lovelace,Lovelace,1,0`)

    expect(guest).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      envelopeName: 'Ada Lovelace',
      party: 'Lovelace',
    })
    expect([...guest.tags]).toEqual(['muhurtam'])
  })

  it('finds tag columns by their suffix, not their position', () => {
    // The exporter appends new tag columns over time, so a hardcoded column
    // letter would break silently the first time one is inserted.
    const shifted = 'first name,last name,a new column,muhurtam (tag),sangeet (tag)'
    const [guest] = guestsFrom(`${shifted}\nAda,Lovelace,whatever,0,1`)

    expect([...guest.tags]).toEqual(['sangeet'])
  })

  it('matches tag headers case-insensitively and ignores surrounding space', () => {
    const messy = ' First Name ,Last Name,Muhurtam (Tag)'
    const [guest] = guestsFrom(`${messy}\nAda,Lovelace,1`)

    expect([...guest.tags]).toEqual(['muhurtam'])
  })

  it('treats only an exact 1 as carrying the tag', () => {
    const [guest] = guestsFrom(`${HEADER}\nAda,Lovelace,Ada Lovelace,Lovelace,,0`)

    expect([...guest.tags]).toEqual([])
  })

  it('numbers rows the way the sheet does, for error messages', () => {
    const [first, second] = guestsFrom(
      `${HEADER}\nAda,Lovelace,Ada Lovelace,Lovelace,1,0\nAlan,Turing,Alan Turing,Turing,1,1`
    )

    // Row 1 is the header, so the first guest is row 2.
    expect(first.row).toBe(2)
    expect(second.row).toBe(3)
  })

  it('skips rows with no name at all', () => {
    const guests = guestsFrom(
      `${HEADER}\nAda,Lovelace,Ada Lovelace,Lovelace,1,0\n,,,,1,0`
    )

    expect(guests).toHaveLength(1)
  })

  it('keeps a guest who has only a first name', () => {
    // 'Prince' is on the real list.
    const [guest] = guestsFrom(`${HEADER}\nPrince,,Prince,,1,0`)

    expect(guest.firstName).toBe('Prince')
    expect(guest.lastName).toBe('')
  })

  it('tolerates a row that stops short of the tag columns', () => {
    const [guest] = guestsFrom(`${HEADER}\nAda,Lovelace`)

    expect(guest.firstName).toBe('Ada')
    expect([...guest.tags]).toEqual([])
  })

  it('leaves optional columns empty when the sheet has none', () => {
    const [guest] = guestsFrom(`first name,last name,muhurtam (tag)\nAda,Lovelace,1`)

    expect(guest.envelopeName).toBe('')
    expect(guest.party).toBe('')
    expect(guest.emails).toEqual([])
  })

  it('reads the email column when the sheet has one', () => {
    const header = 'first name,last name,email,muhurtam (tag)'
    const [guest] = guestsFrom(`${header}\nAda,Lovelace,Ada@Example.com,1`)

    expect(guest.emails).toEqual(['ada@example.com'])
  })

  it('reads the RSVP columns verbatim, leaving them to be interpreted later', () => {
    const header =
      'first name,last name,muhurtham,golkonda guest covered,golkonda guest own,muhurtam (tag)'
    const [guest] = guestsFrom(
      `${header}\nAda,Lovelace,Attending,,I do not need accommodation.,1`
    )

    expect(guest.muhurthamRsvp).toBe('Attending')
    // '' is an unanswered question, and has to stay distinguishable from the
    // absent field that means the column itself is gone.
    expect(guest.golkondaCoveredAnswer).toBe('')
    expect(guest.golkondaOwnAnswer).toBe('I do not need accommodation.')
  })

  it('omits the RSVP fields entirely when the sheet has no such columns', () => {
    const [guest] = guestsFrom(`first name,last name,muhurtam (tag)\nAda,Lovelace,1`)

    expect(guest.muhurthamRsvp).toBeUndefined()
    expect(guest.golkondaCoveredAnswer).toBeUndefined()
    expect(guest.golkondaOwnAnswer).toBeUndefined()
  })

  it('refuses an empty roster', () => {
    expect(() => rowsToGuests([])).toThrow(/no header row/)
  })

  it('refuses a roster with no name columns', () => {
    expect(() => guestsFrom('envelope name,party,muhurtam (tag)\nAda Lovelace,Lovelace,1')).toThrow(
      /first name.*last name/
    )
  })

  it('refuses a sheet with no tag columns, which is the wrong sheet', () => {
    expect(() => guestsFrom('first name,last name\nAda,Lovelace')).toThrow(/wrong sheet/)
  })
})

describe('parseEmails', () => {
  it('treats the export’s literal #N/A as no email', () => {
    // 128 rows of the real sheet carry this formula artifact.
    expect(parseEmails('#N/A')).toEqual([])
    expect(parseEmails('')).toEqual([])
  })

  it('splits a cell holding several addresses', () => {
    // Row 313 of the real sheet holds two addresses separated by a space.
    expect(parseEmails('one@example.com two@example.org')).toEqual([
      'one@example.com',
      'two@example.org',
    ])
    expect(parseEmails('one@example.com, two@example.org')).toEqual([
      'one@example.com',
      'two@example.org',
    ])
  })

  it('lowercases and dedupes', () => {
    expect(parseEmails('Ada@Example.com ada@example.com')).toEqual(['ada@example.com'])
  })
})
