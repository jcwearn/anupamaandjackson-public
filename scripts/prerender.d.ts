// prerender.js runs under plain node after the build, so it can't be TypeScript
// and can't import from src. This declares the one thing it exports for
// prerenderRoutes.test.tsx, which checks the list against the SSR router.
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
