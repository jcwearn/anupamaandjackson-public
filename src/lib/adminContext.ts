import { useOutletContext } from 'react-router-dom'
import type { GuestSummaryEntry } from './adminUnlock'

/**
 * What AdminLayout hands its tools on the outlet.
 *
 * Split out of AdminLayout.tsx because that file exports a component, and a
 * module exporting both a component and non-components breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json. Same reason
 * useHiddenOnScrollDown.ts is not inside StickyChipBar.tsx.
 */
export interface AdminContext {
  /** The decrypted roster. Only the tools see it, and only past the gate. */
  summary: GuestSummaryEntry[]
}

/**
 * Typed access to what AdminLayout provides. Only meaningful inside the
 * unlocked branch — every tool renders there, so the roster is always present.
 */
export function useAdminContext(): AdminContext {
  return useOutletContext<AdminContext>()
}
