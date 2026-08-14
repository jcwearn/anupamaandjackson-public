import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { manifest } from '../scripts/og/manifest.js'
import { renderOgHtml, HEIGHT, WIDTH } from '../scripts/og/template.js'
import { jpegSize } from '../scripts/lib/jpegSize.js'
import { routes } from '../scripts/prerender.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Hand-drawn artwork that happens to be named like a generated file. Listed
// here rather than filtered by name so a new og-*.jpg that nobody wired into
// the manifest still fails the coverage check below.
const NOT_GENERATED = new Set(['og-save-the-date.jpg'])

// The routes the generator is responsible for: everything pointing at a
// public/og-*.jpg. The invite pages share a cover image and the engagement
// pages have no OG image at all, so neither matches.
const generatedRoutes = routes.filter(
  (route) =>
    /\/og-[\w-]+\.jpg$/.test(route.ogImage ?? '') && !NOT_GENERATED.has(ogFileName(route))
)

function ogFileName(route) {
  return route.ogImage.slice(route.ogImage.lastIndexOf('/') + 1)
}

describe('og manifest', () => {
  it('covers every route that points at a generated image, and no others', () => {
    // The two lists are written out separately, so a page can gain an OG image
    // without a manifest entry to render it — which ships a broken preview
    // rather than failing. Same guard as prerenderRoutes.test.tsx.
    const declared = generatedRoutes.map(ogFileName).sort()
    const generated = manifest.map((entry) => entry.output).sort()

    expect(generated).toEqual(declared)
  })

  it('points each entry at the route it claims', () => {
    for (const entry of manifest) {
      const route = routes.find((candidate) => candidate.path === entry.route)
      expect(route, `${entry.slug} names a route that does not exist`).toBeDefined()
      expect(ogFileName(route), `${entry.slug} is not the image ${entry.route} uses`).toBe(
        entry.output
      )
    }
  })

  it('gives every entry a unique slug and output file', () => {
    expect(new Set(manifest.map((entry) => entry.slug)).size).toBe(manifest.length)
    expect(new Set(manifest.map((entry) => entry.output)).size).toBe(manifest.length)
  })

  it('has the source photos it renders from', () => {
    for (const entry of manifest) {
      for (const path of [entry.photo, ...(entry.covers ?? [])].filter(Boolean)) {
        expect(existsSync(join(root, path)), `${entry.slug}: ${path} is missing`).toBe(true)
      }
    }
  })

  it('gives every entry with a panel something to put in it', () => {
    for (const entry of manifest) {
      if (entry.variant === 'centered') continue
      expect(
        Boolean(entry.photo) || Boolean(entry.covers),
        `${entry.slug} has no photo and is not the centered variant`
      ).toBe(true)
    }
  })

  it('only asks for variants the template knows how to render', () => {
    // template.js looks the variant up in a type-scale table and throws on a
    // miss, but that only fires at render time — long after the manifest is
    // read. A typo'd variant should fail here instead.
    for (const entry of manifest) {
      expect(
        entry.variant ?? 'split',
        `${entry.slug} asks for an unknown variant`
      ).toMatch(/^(split|landscape|centered)$/)
    }
  })
})

describe('og text budgets', () => {
  // Both limits are the current longest string plus a little room. The layout
  // has no auto-fit, so a title past this wraps into the photo panel. Going
  // past either means picking a titleSize and looking at the render, not
  // raising the number.
  it('keeps titles short enough for the split layout', () => {
    for (const entry of manifest) {
      expect(entry.title.length, `${entry.slug}: "${entry.title}" is too long`).toBeLessThanOrEqual(
        22
      )
      expect(entry.title.trim()).not.toBe('')
    }
  })

  it('gives every entry a date line that fits', () => {
    for (const entry of manifest) {
      expect(entry.date.trim(), `${entry.slug} has no date line`).not.toBe('')
      expect(
        entry.date.length,
        `${entry.slug}: "${entry.date}" will overflow`
      ).toBeLessThanOrEqual(40)
    }
  })
})

describe('og template', () => {
  it('escapes the ampersands that nearly every title carries', () => {
    const html = renderOgHtml(
      { title: 'Questions & Answers', date: 'A & B', eyebrow: 'R & W' },
      { photo: 'data:image/jpeg;base64,' }
    )

    expect(html).toContain('Questions &amp; Answers')
    expect(html).not.toMatch(/Questions & Answers/)
  })

  // Built here rather than looked up in the manifest: every page currently has
  // a photo it suits, so nothing uses this variant right now. It stays in the
  // template because the alternative — cropping a bad photo to fill the panel —
  // is what the last round of review was about.
  it('drops the photo panel for the centered variant', () => {
    const html = renderOgHtml(
      { slug: 'test', variant: 'centered', title: 'T', date: 'D' },
      {}
    )

    expect(html).not.toContain('class="panel"')
  })

  it('refuses a variant it has no type scale for', () => {
    expect(() =>
      renderOgHtml({ slug: 'test', variant: 'diagonal', title: 'T', date: 'D' }, {})
    ).toThrow(/unknown variant/)
  })

  it('sets the couple line everywhere but home, where the title already is it', () => {
    const home = manifest.find((entry) => entry.route === '/')
    expect(renderOgHtml(home, { photo: '' })).not.toContain('class="names"')

    for (const entry of manifest.filter((candidate) => candidate.route !== '/')) {
      const html = renderOgHtml(entry, { photo: '', covers: entry.covers && [] })
      expect(html, `${entry.slug} is missing the couple line`).toContain('class="names"')
    }
  })

  it('stands the bookshelf covers on boards rather than in one long row', () => {
    const entry = manifest.find((candidate) => candidate.covers)
    const html = renderOgHtml(entry, { covers: entry.covers.map(() => 'data:,') })

    // Three to a board — six covers in one row would render them as slivers.
    expect(html.match(/class="board"/g)).toHaveLength(Math.ceil(entry.covers.length / 3))
  })
})

describe('rendered og images', () => {
  it('matches the dimensions prerender.js declares', () => {
    // The bug this whole change fixes: / declared 1000x1250 while every other
    // page declared 1200x630, and nothing checked either against the file.
    for (const route of generatedRoutes) {
      const path = join(root, 'public', ogFileName(route))
      expect(existsSync(path), `${path} has not been generated`).toBe(true)

      const size = jpegSize(readFileSync(path), path)
      expect(size, `${route.path} declares the wrong size`).toEqual({
        width: route.ogImageWidth,
        height: route.ogImageHeight,
      })
      expect(size).toEqual({ width: WIDTH, height: HEIGHT })
    }
  })

  it('describes each image the same way in the manifest and in prerender.js', () => {
    // The alt text is written in both files — prerender.js emits it, and the
    // manifest keeps it next to the photo it describes so changing the photo
    // and forgetting the words is a test failure rather than a wrong caption.
    for (const route of generatedRoutes) {
      const entry = manifest.find((candidate) => candidate.output === ogFileName(route))
      expect(route.ogImageAlt, `${route.path} has no ogImageAlt`).toBeTruthy()
      expect(route.ogImageAlt, `${route.path}: alt text has drifted from the manifest`).toBe(
        entry.alt
      )
    }
  })
})
