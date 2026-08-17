import React, { useEffect, useId, useRef, useState } from 'react'
import { FilterIcon } from '../icons/FilterIcon'

export type SortDir = 'asc' | 'desc'

/**
 * The sort-and-filter menu on a column heading, in the shape a spreadsheet puts
 * there: sort both ways at the top, then a tick beside every value the column
 * holds, each with an "Only" that keeps that one and drops the rest.
 *
 * Chip rows were the other option and are what /admin/guest-summary uses, but
 * they answer a different question. Those chips are three fixed views of the
 * guest list, decided once and unlikely to grow. This table's useful questions
 * are "which rooms are twin" and "who has checked out by day 3" — the values
 * come out of the data, and a chip row would have to be rewritten every time
 * one did. Hanging the menu off the column keeps the question and the column
 * that answers it in the same place.
 *
 * `hidden` rather than `selected`: the empty set means no filter, so a value
 * appearing in the data for the first time shows up rather than being silently
 * excluded by a `selected` list written before it existed.
 *
 * Omit `values` for a column that only makes sense to sort — a room number
 * filter would be twenty-four tickboxes answering nothing.
 */
export const ColumnMenu: React.FC<{
  column: string
  sort: SortDir | null
  onSort: (dir: SortDir) => void
  /** Every distinct value in the column, in the order to list them. */
  values?: string[]
  /**
   * How to write a value that does not read as itself in a list of tickboxes.
   * A blank cell needs a name to be tickable at all, and a column that renders
   * an em dash for "nobody" should say so in words where there is room for
   * them. Keyed by the stored value, so filtering still compares raw strings.
   */
  labels?: Record<string, string>
  hidden?: Set<string>
  onHiddenChange?: (next: Set<string>) => void
  /** Labels the sort options 1→9 rather than A→Z. */
  numeric?: boolean
  /**
   * Which edge of the heading the panel hangs from. It is 14rem wide and the
   * heading it hangs off can be four characters, so the wrong edge opens it
   * outside the card: hang it from whichever side has the room.
   */
  align?: 'left' | 'right'
}> = ({
  column,
  sort,
  onSort,
  values,
  labels,
  hidden = EMPTY,
  onHiddenChange,
  numeric,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const labelId = useId()

  // The same dismissal pair GuestBadge's popover uses: Escape for the keyboard,
  // a pointerdown outside for everything else.
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const filtering = hidden.size > 0
  const showing = values ? values.filter((value) => !hidden.has(value)).length : 0

  const toggle = (value: string) => {
    const next = new Set(hidden)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onHiddenChange?.(next)
  }

  return (
    <span ref={containerRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        // The label says which state it is in, because the colour cannot: this
        // is the only thing on the row that tells you rows are being withheld.
        aria-label={`Sort and filter ${column}${filtering ? ` (filtered to ${showing} of ${values?.length ?? 0})` : ''}`}
        onClick={() => setOpen((was) => !was)}
        className={`cursor-pointer rounded transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1 ${
          filtering
            ? // Filled, not merely tinted. A filtered column is hiding rows,
              // and that has to be visible from across the table rather than
              // being one more shade of pink among the headings.
              'bg-rosewood p-1 text-cream hover:bg-rosewood/85'
            : `p-1 hover:bg-lily/50 ${sort ? 'text-rosewood' : 'text-zeus/40'}`
        }`}
      >
        <FilterIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="group"
          aria-labelledby={labelId}
          // Normal case rather than the heading's uppercase, and left-aligned
          // rather than following the column: this is a menu that happens to
          // hang off a heading, not more heading.
          className={`absolute top-full z-20 mt-1 w-56 rounded-xl border border-gold/50 bg-white p-1 text-left text-sm font-normal normal-case shadow-lg ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <p id={labelId} className="px-3 py-2 text-xs tracking-wide text-zeus/50 uppercase">
            {column}
          </p>

          <MenuButton onClick={() => (onSort('asc'), setOpen(false))} active={sort === 'asc'}>
            {numeric ? 'Sort 1 → 9' : 'Sort A → Z'}
          </MenuButton>
          <MenuButton onClick={() => (onSort('desc'), setOpen(false))} active={sort === 'desc'}>
            {numeric ? 'Sort 9 → 1' : 'Sort Z → A'}
          </MenuButton>

          {values && values.length > 0 && (
            <>
              <div className="my-1 border-t border-gold/40" />
              {/* Stacked, not side by side: at the panel's width the two sat on
                  one line only until a column had a value long enough to widen
                  it, and then "Select all" broke across two lines mid-word. */}
              <div className="px-3 py-1 text-xs text-zeus/60">
                <p>
                  Showing {showing} of {values.length}
                </p>
                <p className="mt-0.5 flex gap-2">
                  <LinkButton onClick={() => onHiddenChange?.(new Set())}>Select all</LinkButton>
                  <span aria-hidden="true">·</span>
                  <LinkButton onClick={() => onHiddenChange?.(new Set(values))}>Clear</LinkButton>
                </p>
              </div>
              <ul className="max-h-56 overflow-y-auto py-1">
                {values.map((value) => {
                  const name = labels?.[value] ?? value
                  return (
                    <li key={value} className="group flex items-center rounded-lg hover:bg-lily/30">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 pl-3">
                        <input
                          type="checkbox"
                          checked={!hidden.has(value)}
                          onChange={() => toggle(value)}
                          className="h-4 w-4 shrink-0 accent-rosewood"
                        />
                        <span className="truncate text-zeus">{name}</span>
                      </label>
                      {/* The tickboxes answer "what do I want gone"; this
                          answers "what do I want left", which for a column of
                          more than three values is the same question and a lot
                          less clicking.

                          A sibling of the label rather than inside it: a click
                          on a button within a label is meant not to reach the
                          control, and browsers have disagreed about that for
                          years. It also holds its space while invisible, so a
                          row does not reflow under the pointer that revealed
                          it. `aria-label` names the value, because "Only" on
                          its own is a word that needs the row to mean
                          anything. */}
                      <button
                        type="button"
                        aria-label={`Show only ${name}`}
                        onClick={() =>
                          onHiddenChange?.(new Set(values.filter((other) => other !== value)))
                        }
                        // Bordered and filled rather than underlined: the two
                        // links above it are the panel's own controls, and this
                        // acts on the row it sits in. `bg-white` because the row
                        // tints on hover and a transparent pill would take that
                        // tint and stop reading as a raised thing.
                        className="mr-2 ml-1 shrink-0 cursor-pointer rounded-full border border-gold/60 bg-white px-2 py-0.5 text-xs text-rosewood opacity-0 transition group-hover:opacity-100 hover:bg-rosewood hover:text-cream focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-gold"
                      >
                        Only
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </span>
  )
}

/** Shared so `hidden` has a stable default and cannot trigger a render loop. */
const EMPTY: Set<string> = new Set()

const MenuButton: React.FC<{
  onClick: () => void
  active: boolean
  children: React.ReactNode
}> = ({ onClick, active, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`block w-full cursor-pointer rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-lily/30 ${
      active ? 'font-medium text-rosewood' : 'text-zeus'
    }`}
  >
    {children}
  </button>
)

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="cursor-pointer text-rosewood underline underline-offset-2 hover:no-underline"
  >
    {children}
  </button>
)

export default ColumnMenu
