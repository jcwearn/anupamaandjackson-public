export declare function fold(value: unknown): string
export declare function stripHonorifics(folded: string): string
export declare function isBlank(value: unknown): boolean
export declare function normalizedKey(first: unknown, last: unknown): string

export interface GuestNameInput {
  firstName?: string
  lastName?: string
  envelopeName?: string
}

export declare function aliasesFor(input?: GuestNameInput): string[]
