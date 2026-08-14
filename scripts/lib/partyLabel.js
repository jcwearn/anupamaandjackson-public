/**
 * Guest-facing labels for the "which one is you?" prompt.
 *
 * The raw `party` column is internal shorthand ('Anu Atta') never meant for
 * guests, so ambiguous buckets are labelled by who else shares the party
 * instead — the one fact a guest reliably knows about their own household.
 */

// Plus-ones are exported as placeholder rows ("Srikrishna's Guest"). The word
// match is a heuristic: a real guest surnamed Guest would be wrongly treated
// as a placeholder, but no such guest exists and the failure mode is only a
// vaguer label, never a crash.
const PLACEHOLDER = /\bguest\b/i

function fullName(member) {
  return [member.firstName, member.lastName].filter(Boolean).join(' ')
}

function joinNames(names) {
  if (names.length === 1) return names[0]
  if (names.length > 3) names = [...names.slice(0, 3), 'others']
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/**
 * 'With Venkat & Aditya Tadanki'-style label from the other members of the
 * guest's party, or '' when there is nothing safe to show (the caller then
 * falls back to the party hint). Never throws.
 */
export function partyHintLabel(guest, partyMembers) {
  const others = (partyMembers ?? []).filter((member) => member.row !== guest.row)
  const named = others.filter((member) => !PLACEHOLDER.test(fullName(member)))

  if (named.length > 0) {
    // A shared surname reads as one household: 'Venkat & Aditya Tadanki'
    // rather than 'Venkat Tadanki & Aditya Tadanki'.
    const surnames = new Set(named.map((member) => member.lastName.trim().toLowerCase()))
    const sharedSurname = surnames.size === 1 && !surnames.has('') && named.length > 1
    const names = sharedSurname
      ? [...named.slice(0, -1).map((member) => member.firstName), fullName(named[named.length - 1])]
      : named.map(fullName)
    return `With ${joinNames(names)}`
  }

  if (others.length > 0) return others.length === 1 ? 'With a guest' : 'With guests'

  // Solo party: the envelope name ('The Prayaga Family') is the only other
  // guest-recognizable handle we hold.
  const envelope = (guest.envelopeName ?? '').trim()
  if (envelope && envelope.toLowerCase() !== fullName(guest).trim().toLowerCase()) {
    return `Invited as ${envelope}`
  }
  return ''
}
