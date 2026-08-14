/**
 * Guest name normalization, shared byte-for-byte between the Node generator
 * (scripts/build-schedule-index.js) and the browser lookup (useGuestSchedule).
 *
 * Both sides feed the output of `normalizedKey` into the same SHA-256 and the
 * same PBKDF2 derivation, so any divergence between them silently makes every
 * guest unfindable. That is why this is one plain-JS module imported by both
 * rather than two implementations kept in step by hand. Typed for TS consumers
 * by the adjacent guestName.d.ts.
 */

// Only titles that are never given names. Deliberately excludes sri/shri/smt:
// 'Srilakshmi' is a real first name on the guest list and stripping a 'sri'
// prefix would corrupt her key.
const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'mx', 'dr'])

// Spreadsheet formula errors leak into the export as literal strings.
const BLANK_VALUES = new Set(['', 'n a', 'na', 'null', 'undefined'])

// NUL rather than a space: with a space, 'Subba Rao' + 'Duvvuri' and
// 'Subba' + 'Rao Duvvuri' would both flatten to 'subba rao duvvuri' and
// resolve to each other's records.
const SEP = '\u0000'

// Unicode combining marks, stripped after NFD decomposition.
const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Lowercases, strips diacritics, and reduces to single-spaced letters.
 * 'Bíllÿ-Böb  Jr.' -> 'billy bob jr'
 */
export function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Drops leading honorifics, but never the only token — a guest recorded as
 * just 'Dr' should still resolve to something rather than the empty string.
 */
export function stripHonorifics(folded) {
  const tokens = folded.split(' ').filter(Boolean)
  while (tokens.length > 1 && HONORIFICS.has(tokens[0])) tokens.shift()
  return tokens.join(' ')
}

/** True for values that carry no name, including exported `#N/A` artifacts. */
export function isBlank(value) {
  return BLANK_VALUES.has(fold(value))
}

/**
 * The canonical lookup key for a first/last pair. This exact string is hashed
 * for the index key and stretched by PBKDF2 for the decryption key.
 */
export function normalizedKey(first, last) {
  const given = stripHonorifics(isBlank(first) ? '' : fold(first))
  const family = isBlank(last) ? '' : fold(last)
  return `${given}${SEP}${family}`
}

/**
 * Every key a guest should be findable under. Hashing makes fuzzy matching
 * impossible — an unrecognized spelling is simply a miss — so the generator
 * indexes each guest under several plausible spellings instead.
 */
export function aliasesFor({ firstName, lastName, envelopeName } = {}) {
  const given = stripHonorifics(isBlank(firstName) ? '' : fold(firstName))
  const family = isBlank(lastName) ? '' : fold(lastName)
  if (!given && !family) return []

  const aliases = new Set([`${given}${SEP}${family}`])

  // 23 guests have multi-token first names ('Subba Rao'). Index the first
  // token alone and the run-together form, since people type both.
  const givenTokens = given.split(' ').filter(Boolean)
  if (givenTokens.length > 1) {
    aliases.add(`${givenTokens[0]}${SEP}${family}`)
    aliases.add(`${givenTokens.join('')}${SEP}${family}`)
  }

  // The envelope name is sometimes fuller or spelled differently than the
  // first/last columns. Treat its final token as the surname.
  if (!isBlank(envelopeName)) {
    const envTokens = stripHonorifics(fold(envelopeName)).split(' ').filter(Boolean)
    if (envTokens.length > 1) {
      const envFamily = envTokens[envTokens.length - 1]
      aliases.add(`${envTokens.slice(0, -1).join(' ')}${SEP}${envFamily}`)
    } else if (envTokens.length === 1) {
      aliases.add(`${envTokens[0]}${SEP}`)
    }
  }

  return [...aliases]
}
