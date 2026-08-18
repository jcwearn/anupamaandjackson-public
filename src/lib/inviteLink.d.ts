export type InviteSide = 'anupama' | 'jackson'

export declare const INVITE_SIDE_TAGS: InviteSide[]

export interface InviteEvent {
  tag: string
  letter: string
  label: string
}

export declare const INVITE_EVENTS: InviteEvent[]

export declare const SUMMARY_EVENTS: InviteEvent[]

export declare function inviteEventsFor(tags: Set<string>): string

export declare function summaryEventsFor(tags: Set<string>): string

export declare function inviteEventsIn(events: string): string

export declare function inviteLinkFor(side: string | undefined, events: string): string | undefined
