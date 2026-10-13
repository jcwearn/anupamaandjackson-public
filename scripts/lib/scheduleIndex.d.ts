// scheduleIndex.js runs under plain node in the schedule sync, so it can't be
// TypeScript. This declares what useGuestSchedule.test.tsx reaches for when it
// builds a real index to decrypt — the generator's own suite
// (tests/scheduleIndex.test.js) is plain JS and needs none of this.
import type { RosterGuest } from './roster.js'

export declare function buildIndex(options: {
  guests: RosterGuest[]
  catalogEvents: unknown[]
  iterations?: number
  sourceHash?: string
  keralaResponses?: unknown[] | null
}): Promise<{ index: unknown; stats: unknown }>
