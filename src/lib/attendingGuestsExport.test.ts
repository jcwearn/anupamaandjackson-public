import { describe, it, expect, vi, afterEach } from 'vitest'
import type { GuestSummaryEntry } from './adminUnlock'
import {
  ATTENDING_GUESTS_FILENAME,
  attendingGuestLists,
  attendingGuestRows,
  exportAttendingGuests,
} from './attendingGuestsExport'

// What the library does with the rows is its own business and its own tests'.
// This file checks the rows it is handed and that the result reaches a download.
const writeXlsxFile = vi.hoisted(() =>
  vi.fn((_rows: unknown, _options?: unknown) => ({
    toBlob: () => Promise.resolve(new Blob(['xlsx'])),
  })),
)
vi.mock('write-excel-file/browser', () => ({ default: writeXlsxFile }))

const guest = (
  name: string,
  list: 'anupama' | 'jackson' | 'vidya' | 'venkat',
  overrides: Partial<GuestSummaryEntry> = {},
): GuestSummaryEntry => ({
  name,
  side: list === 'jackson' ? 'jackson' : 'anupama',
  ...(list === 'vidya' || list === 'venkat' ? { tag: list } : {}),
  status: 'attending',
  ...overrides,
})

describe('attendingGuestLists', () => {
  it('keeps only guests who are attending something', () => {
    expect(
      attendingGuestLists([
        guest('Ada Lovelace', 'jackson'),
        guest('Grace Hopper', 'jackson', { status: 'declined' }),
        guest('Alan Turing', 'jackson', { status: 'none' }),
      ]),
    ).toEqual([[['Ada Lovelace']]])
  })

  it('groups by list in chip order, alphabetical within each', () => {
    expect(
      attendingGuestLists([
        guest('Vera Rubin', 'venkat'),
        guest('Marie Curie', 'vidya'),
        guest('Grace Hopper', 'jackson'),
        guest('Lise Meitner', 'anupama'),
        guest('alan Turing', 'jackson'),
        guest('Carl Sagan', 'jackson'),
        guest('Emmy Noether', 'anupama'),
      ]),
    ).toEqual([
      [['Emmy Noether'], ['Lise Meitner']],
      [['alan Turing'], ['Carl Sagan'], ['Grace Hopper']],
      [['Marie Curie']],
      [['Vera Rubin']],
    ])
  })

  it("does not repeat Vidya's or Venkat's guests under Anupama", () => {
    // All three lists are on Anupama's side; hers is what is left of it.
    expect(
      attendingGuestLists([guest('Marie Curie', 'vidya'), guest('Vera Rubin', 'venkat')]),
    ).toEqual([[['Marie Curie']], [['Vera Rubin']]])
  })

  it('includes infants', () => {
    expect(attendingGuestLists([guest('Enrico Fermi', 'jackson', { infant: true })])).toEqual([
      [['Enrico Fermi']],
    ])
  })

  it('puts a guest on no list at the end rather than dropping them', () => {
    expect(
      attendingGuestLists([
        { name: 'Rosalind Franklin', status: 'attending' },
        guest('Ada Lovelace', 'venkat'),
      ]),
    ).toEqual([[['Ada Lovelace']], [['Rosalind Franklin']]])
  })

  it('keeps a party together, sorted under its first-listed member', () => {
    // Sorting names one by one put Ada first and Vera last, with Carl between.
    expect(
      attendingGuestLists([
        guest('Vera Rubin', 'jackson', { party: 1 }),
        guest('Ada Lovelace', 'jackson', { party: 1 }),
        guest('Carl Sagan', 'jackson'),
        guest('Alan Turing', 'jackson', { party: 2 }),
        guest('Grace Hopper', 'jackson', { party: 2 }),
      ]),
    ).toEqual([[['Alan Turing', 'Grace Hopper'], ['Carl Sagan'], ['Vera Rubin', 'Ada Lovelace']]])
  })

  it('leaves out the members of a party who are not attending', () => {
    expect(
      attendingGuestLists([
        guest('Marie Curie', 'anupama', { party: 3 }),
        guest('Lise Meitner', 'anupama', { party: 3, status: 'declined' }),
        guest('Emmy Noether', 'anupama', { party: 3 }),
      ]),
    ).toEqual([[['Marie Curie', 'Emmy Noether']]])
  })

  it('is empty when nobody is attending', () => {
    expect(attendingGuestLists([guest('Ada Lovelace', 'jackson', { status: 'none' })])).toEqual([])
  })
})

const BORDER = { style: 'medium', color: '#8e5164' }
const side = (edge: 'left' | 'right' | 'top' | 'bottom') => ({
  [`${edge}BorderStyle`]: BORDER.style,
  [`${edge}BorderColor`]: BORDER.color,
})

describe('attendingGuestRows', () => {
  it('boxes a party and leaves a lone guest plain, with a blank row between lists', () => {
    expect(
      attendingGuestRows([
        guest('Marie Curie', 'anupama'),
        guest('Alan Turing', 'jackson', { party: 1 }),
        guest('Enrico Fermi', 'jackson', { party: 1 }),
        guest('Grace Hopper', 'jackson', { party: 1 }),
      ]),
    ).toEqual([
      [{ value: 'Marie Curie' }],
      [null],
      [{ value: 'Alan Turing', ...side('left'), ...side('right'), ...side('top') }],
      [{ value: 'Enrico Fermi', ...side('left'), ...side('right') }],
      [{ value: 'Grace Hopper', ...side('left'), ...side('right'), ...side('bottom') }],
    ])
  })
})

describe('exportAttendingGuests', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hands the rows to the library and saves what it writes', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:stub'),
      revokeObjectURL: vi.fn(),
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const summary = [guest('Grace Hopper', 'jackson'), guest('Ada Lovelace', 'jackson')]

    await exportAttendingGuests(summary)

    expect(writeXlsxFile).toHaveBeenCalledOnce()
    expect(writeXlsxFile.mock.calls[0][0]).toEqual(attendingGuestRows(summary))
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(ATTENDING_GUESTS_FILENAME)
  })
})
