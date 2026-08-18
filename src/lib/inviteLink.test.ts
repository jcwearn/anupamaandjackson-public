import { describe, it, expect } from 'vitest'
import {
  INVITE_EVENTS,
  INVITE_SIDE_TAGS,
  SUMMARY_EVENTS,
  inviteEventsFor,
  inviteEventsIn,
  inviteLinkFor,
  summaryEventsFor,
} from './inviteLink'

describe('inviteEventsFor', () => {
  it('reads the three events off the tags, earliest first', () => {
    // Order is what makes the letters comparable between guests. Three, not
    // four: the pellikuthuru is on /admin/guest-summary and on no invitation,
    // so it belongs to summaryEventsFor below and never appears here.
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

  it('leaves the pellikuthuru out, since no invitation is narrowed by it', () => {
    // The one that would break every link if it crept in: LINKS is keyed by
    // these letters, and a guest coming out as 'PSMR' matches none of its keys.
    expect(inviteEventsFor(new Set(['pellikuthuru', 'muhurtam', 'reception']))).toBe('MR')
    expect(inviteEventsFor(new Set(['pellikuthuru']))).toBe('')
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

describe('summaryEventsFor', () => {
  it('reads every column on the guest-summary table, earliest first', () => {
    // The pellikuthuru is on the 26th and the rest run from the 27th, so it
    // leads — and it is the one difference from inviteEventsFor above.
    expect(SUMMARY_EVENTS.map(({ letter }) => letter)).toEqual(['P', 'S', 'M', 'R'])
    expect(summaryEventsFor(new Set(['reception', 'pellikuthuru', 'sangeet', 'muhurtam']))).toBe(
      'PSMR',
    )
    expect(summaryEventsFor(new Set(['pellikuthuru', 'muhurtam']))).toBe('PM')
    expect(summaryEventsFor(new Set(['muhurtam', 'reception']))).toBe('MR')
  })

  it('ignores the tags that are not one of the four', () => {
    expect(summaryEventsFor(new Set(['anupama', 'venkat', 'optional-trip']))).toBe('')
  })
})

describe('inviteEventsIn', () => {
  it('narrows a summary string back to the invitation it names', () => {
    // What the page does before reaching for the copy link. 'PSMR' and 'SMR'
    // are the same invitation, and a guest invited to the pellikuthuru alone
    // has none at all.
    expect(inviteEventsIn('PSMR')).toBe('SMR')
    expect(inviteEventsIn('SMR')).toBe('SMR')
    expect(inviteEventsIn('PM')).toBe('M')
    expect(inviteEventsIn('P')).toBe('')
    expect(inviteEventsIn('')).toBe('')
  })

  it('agrees with inviteEventsFor for any set of tags', () => {
    // The invariant the two-string arrangement rests on: publishing the wider
    // string loses nothing, because the narrower one falls out of it. Every
    // subset of the four tags, not a handful of examples.
    const tags = SUMMARY_EVENTS.map(({ tag }) => tag)
    for (let mask = 0; mask < 1 << tags.length; mask += 1) {
      const set = new Set(tags.filter((_, index) => mask & (1 << index)))
      expect(inviteEventsIn(summaryEventsFor(set))).toBe(inviteEventsFor(set))
    }
  })
})
