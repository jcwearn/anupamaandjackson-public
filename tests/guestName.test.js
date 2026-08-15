import { describe, expect, it } from 'vitest'
import { aliasesFor, fold, isBlank, normalizedKey } from '../src/lib/guestName.js'

const SEP = '\u0000'
const key = (given, family) => `${given}${SEP}${family}`

describe('fold', () => {
  it('strips diacritics, punctuation and case', () => {
    expect(fold('Ana Sofía')).toBe('ana sofia')
    expect(fold('Bíllÿ-Böb  Jr.')).toBe('billy bob jr')
    expect(fold("O'Brien")).toBe('o brien')
  })

  it('tolerates null and undefined', () => {
    expect(fold(null)).toBe('')
    expect(fold(undefined)).toBe('')
  })
})

describe('isBlank', () => {
  it('treats exported spreadsheet errors as empty', () => {
    // The export leaks '#N/A' into columns as a literal string.
    expect(isBlank('#N/A')).toBe(true)
    expect(isBlank('')).toBe(true)
    expect(isBlank('   ')).toBe(true)
  })

  it('does not treat real names as empty', () => {
    expect(isBlank('Ram')).toBe(false)
    expect(isBlank('Na')).toBe(true)
  })
})

describe('normalizedKey', () => {
  it('strips leading honorifics', () => {
    expect(normalizedKey('Dr. Emmett', 'Brown')).toBe(key('emmett', 'brown'))
    expect(normalizedKey('Mrs Ada', 'Lovelace')).toBe(key('ada', 'lovelace'))
  })

  it('keeps an honorific that is the only token', () => {
    expect(normalizedKey('Dr', '')).toBe(key('dr', ''))
  })

  it('does not mangle names that merely start like an honorific', () => {
    // Regression: 'Srilakshmi' is a real first name on the guest list, so
    // sri/shri/smt must never be stripped as honorifics.
    expect(normalizedKey('Srilakshmi', 'Jandhyala')).toBe(key('srilakshmi', 'jandhyala'))
    expect(normalizedKey('Drew', 'Barrymore')).toBe(key('drew', 'barrymore'))
  })

  it('separates given and family names unambiguously', () => {
    // With a space separator both of these flatten to 'subba rao duvvuri'
    // and each guest resolves to the other's record.
    expect(normalizedKey('Subba Rao', 'Duvvuri')).not.toBe(normalizedKey('Subba', 'Rao Duvvuri'))
  })

  it('handles a missing last name', () => {
    expect(normalizedKey('Prince', '')).toBe(key('prince', ''))
    expect(normalizedKey('Prince', '#N/A')).toBe(key('prince', ''))
  })
})

describe('aliasesFor', () => {
  it('indexes multi-token first names under each plausible spelling', () => {
    const aliases = aliasesFor({ firstName: 'Subba Rao', lastName: 'Duvvuri' })
    expect(aliases).toContain(key('subba rao', 'duvvuri'))
    expect(aliases).toContain(key('subba', 'duvvuri'))
    expect(aliases).toContain(key('subbarao', 'duvvuri'))
  })

  it('folds accented names so an unaccented spelling still matches', () => {
    expect(aliasesFor({ firstName: 'Ana Sofía', lastName: 'Ruiz' })).toContain(
      key('ana sofia', 'ruiz'),
    )
  })

  it('adds the envelope name when it differs from the columns', () => {
    const aliases = aliasesFor({
      firstName: 'Bob',
      lastName: 'Smith',
      envelopeName: 'Robert Smith',
    })
    expect(aliases).toContain(key('bob', 'smith'))
    expect(aliases).toContain(key('robert', 'smith'))
  })

  it('returns nothing for a row with no name at all', () => {
    expect(aliasesFor({ firstName: '', lastName: '' })).toEqual([])
    expect(aliasesFor()).toEqual([])
  })
})
