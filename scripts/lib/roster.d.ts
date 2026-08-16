// roster.js runs under plain node in the schedule sync, so it can't be
// TypeScript. This declares what useGuestSchedule.test.tsx reaches for when it
// builds a real index to decrypt.
export interface RosterGuest {
  /** 1-based sheet row, for error messages that point at real rows. */
  row: number
  firstName: string
  lastName: string
  envelopeName: string
  party: string
  /** Normalized (lowercased, deduped) addresses parsed from the email cell. */
  emails: string[]
  tags: Set<string>
  /**
   * Verbatim RSVP cells. '' means the guest hasn't answered; absent means the
   * sheet had no such column at all.
   */
  pellikuthuruRsvp?: string
  sangeetRsvp?: string
  muhurthamRsvp?: string
  receptionRsvp?: string
  golkondaCoveredAnswer?: string
  golkondaOwnAnswer?: string
}

export declare function parseCsv(text: string): string[][]
export declare function parseEmails(value: string): string[]
export declare function rowsToGuests(rows: string[][]): RosterGuest[]
export declare function readFixture(path: string): Promise<RosterGuest[]>
