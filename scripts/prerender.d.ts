// prerender.js runs under plain node after the build, so it can't be TypeScript
// and can't import from src. This declares what it exports for
// prerenderRoutes.test.tsx, which checks the list against the SSR router and
// the redirect rules against both.
export declare const routes: {
  path: string
  outputPath: string
  title: string
  description: string
  ogImage: string | null
  ogImageWidth?: number
  ogImageHeight?: number
  ogImageAlt?: string
}[]

/** public/_redirects, one [from, to, status] per rule, comments and blanks dropped. */
export declare function readRedirects(): string[][]
