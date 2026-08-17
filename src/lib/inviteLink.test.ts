import { describe, it, expect } from 'vitest'
import { INVITE_EVENTS, INVITE_SIDE_TAGS, inviteEventsFor, inviteLinkFor } from './inviteLink'

describe('inviteEventsFor', () => {
  it('reads the three events off the tags, earliest first', () => {
    // Order is what makes the letters comparable between guests, and it is the
    // order of the columns on /admin/guest-summary.
    expect(inviteEventsFor(new Set(['reception', 'sangeet', 'muhurtam']))).toBe('SMR')
    expect(inviteEventsFor(new Set(['muhurtam', 'reception']))).toBe('MR')
    expect(inviteEventsFor(new Set(['muhurtam']))).toBe('M')
  })

  it('ignores the tags that are not one of the three', () => {
    // A guest carries plenty of others — their side, their parents' list, the
    // hotel, the Kerala trip — and none of them belong in this column.
    expect(inviteEventsFor(new Set(['anupama', 'vidya', 'optional-trip', 'muhurtam']))).toBe('M')
    expect(inviteEventsFor(new Set())).toBe('')
  })

  it("spells the Muhurtham tag the way With Joy does, with one 'h'", () => {
    // The RSVP column beside it has two. Getting this wrong empties the middle
    // column for all 649 guests and nothing else notices.
    expect(INVITE_EVENTS.map(({ tag }) => tag)).toEqual(['sangeet', 'muhurtam', 'reception'])
    expect(inviteEventsFor(new Set(['muhurtham']))).toBe('')
  })
})

describe('inviteLinkFor', () => {
  it.each([
    ['anupama', 'SMR', '/invites/tadanki/'],
    ['anupama', 'MR', '/invites/tadanki/reception/'],
    ['anupama', 'M', '/invites/tadanki/muhurtham/'],
    ['jackson', 'SMR', '/invites/wearn/'],
  ])('sends a %s guest invited to %s to their own page', (side, events, path) => {
    expect(inviteLinkFor(side, events)).toBe(path)
  })

  it('keeps the trailing slash, which the routes and the preview server need', () => {
    for (const side of INVITE_SIDE_TAGS) {
      expect(inviteLinkFor(side, 'SMR')).toMatch(/\/$/)
    }
  })

  it('has nothing for a Jackson-side guest short of the full invitation', () => {
    // There is no narrowed 'wearn' variant. The sync fails on this rather than
    // hand them an invitation to two events they were not asked to.
    expect(inviteLinkFor('jackson', 'MR')).toBeUndefined()
    expect(inviteLinkFor('jackson', 'M')).toBeUndefined()
  })

  it('has nothing for a guest with no side or no events', () => {
    expect(inviteLinkFor(undefined, 'SMR')).toBeUndefined()
    expect(inviteLinkFor('anupama', '')).toBeUndefined()
    // Sangeet without Reception is not a combination the roster has, and not
    // one any of the four pages covers.
    expect(inviteLinkFor('anupama', 'SM')).toBeUndefined()
  })
})
