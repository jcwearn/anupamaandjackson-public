import { readFile } from 'node:fs/promises'
import { createSign } from 'node:crypto'

const TAG_SUFFIX = ' (tag)'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * RSVP columns, as opposed to the invitation tags beside them. A tag says what
 * a guest was offered; these say what they answered.
 *
 * A guest gets the field only when the sheet has the column, so '' means "no
 * answer" and absent means "no such column" — a distinction
 * `assertGolkondaColumnsExist` needs to tell a roster of undecided guests from
 * the wrong sheet.
 */
const RSVP_COLUMNS = [
  ['pellikuthuru', 'pellikuthuruRsvp'],
  ['sangeet', 'sangeetRsvp'],
  ['muhurtham', 'muhurthamRsvp'],
  ['reception', 'receptionRsvp'],
  ['golkonda guest covered', 'golkondaCoveredAnswer'],
  ['golkonda guest own', 'golkondaOwnAnswer'],
]
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

/**
 * Minimal RFC 4180 parser. Guest names contain commas ('Subba Rao, Jr.') and
 * the export quotes them, so splitting on ',' is not good enough.
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * The export's email cell is free text: 128 rows carry a literal '#N/A'
 * formula artifact, and at least one holds two addresses in a single cell.
 * Requiring an '@' filters the artifacts and blanks in one rule.
 */
export function parseEmails(value) {
  const tokens = String(value ?? '')
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.includes('@'))
  return [...new Set(tokens)]
}

/**
 * Turns a header row plus data rows into guest records.
 *
 * Tags are discovered by header suffix rather than column letter — the
 * exporter appends new tag columns over time, and hardcoding 'AI' would break
 * silently the first time a column is inserted.
 */
export function rowsToGuests(rows) {
  if (rows.length === 0) throw new Error('Roster is empty — no header row found.')

  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const indexOf = (name) => headers.indexOf(name)

  const firstIdx = indexOf('first name')
  const lastIdx = indexOf('last name')
  const envelopeIdx = indexOf('envelope name')
  const partyIdx = indexOf('party')
  // Optional like 'party': the exporter is expected to drift, and a missing
  // column should degrade to no-emails rather than fail the sync.
  const emailIdx = indexOf('email')

  if (firstIdx === -1 || lastIdx === -1) {
    throw new Error("Roster is missing a 'first name' or 'last name' column.")
  }

  const rsvpColumns = RSVP_COLUMNS.map(([header, field]) => ({
    field,
    index: indexOf(header),
  })).filter(({ index }) => index !== -1)

  const tagColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.endsWith(TAG_SUFFIX))
    .map(({ header, index }) => ({ tag: header.slice(0, -TAG_SUFFIX.length).trim(), index }))

  if (tagColumns.length === 0) {
    throw new Error("Roster has no '… (tag)' columns — wrong sheet?")
  }

  return rows.slice(1).flatMap((row, offset) => {
    const cell = (index) => (index === -1 ? '' : (row[index] ?? '').trim())
    const firstName = cell(firstIdx)
    const lastName = cell(lastIdx)
    if (!firstName && !lastName) return []

    const tags = new Set(
      tagColumns.filter(({ index }) => Number(cell(index)) === 1).map(({ tag }) => tag),
    )

    return [
      {
        // 1-based sheet row, for error messages that point at real rows.
        row: offset + 2,
        firstName,
        lastName,
        envelopeName: cell(envelopeIdx),
        party: cell(partyIdx),
        emails: parseEmails(cell(emailIdx)),
        tags,
        // Kept verbatim; scripts/lib/scheduleIndex.js owns what they mean, and
        // asserts the columns were there at all.
        ...Object.fromEntries(rsvpColumns.map(({ field, index }) => [field, cell(index)])),
      },
    ]
  })
}

export async function readFixture(path) {
  return rowsToGuests(parseCsv(await readFile(path, 'utf-8')))
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url')
}

/**
 * Signs a service-account JWT and exchanges it for an access token. Hand-rolled
 * against node:crypto so the sync stays dependency-free — google-auth-library
 * would be the only reason to add a runtime dependency to this repo.
 */
async function fetchAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify(claim),
  )}`
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(privateKey.replace(/\\n/g, '\n'), 'base64url')

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`)
  }
  return (await response.json()).access_token
}

export async function readGoogleSheet({ clientEmail, privateKey, sheetId, sheetName = 'latest' }) {
  const token = await fetchAccessToken(clientEmail, privateKey)
  const range = encodeURIComponent(`${sheetName}!A1:BZ100000`)
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(`Sheets read failed (${response.status}): ${await response.text()}`)
  }

  const { values } = await response.json()
  if (!values || values.length === 0) throw new Error(`Sheet '${sheetName}' returned no rows.`)
  return rowsToGuests(values)
}
