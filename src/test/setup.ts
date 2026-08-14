// Adds the jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) to
// vitest's expect. Tests import describe/it/expect/vi from 'vitest' directly —
// no globals — so tsconfig needs no `types` entry.
import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only registers its own afterEach cleanup when vitest runs
// with globals enabled, which we don't. Without this, renders pile up in the
// document and queries hit "found multiple elements".
afterEach(cleanup)
