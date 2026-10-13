/**
 * The Wedding HQ pages the admin hub links to.
 *
 * Its own module rather than a constant in AdminIndex because
 * react/only-export-components forbids a route module exporting anything else,
 * and the test needs the list. public/_redirects sends the old /admin/* paths
 * to these same URLs; prerenderRoutes.test.tsx checks the two agree.
 */
export const HQ_ORIGIN = 'https://hq.anupamaandjackson.com'

export const HQ_TOOLS = [
  {
    href: `${HQ_ORIGIN}/invite-links`,
    title: 'Invite Links',
    blurb: 'Every version of the invitation, and who each one is for.',
  },
  {
    href: `${HQ_ORIGIN}/guests`,
    title: 'Guest Summary',
    blurb: 'Who has answered, and who still needs asking.',
  },
  {
    href: `${HQ_ORIGIN}/kerala`,
    title: 'Kerala Trip',
    blurb: 'Rooming, flights and money for the travel agent.',
  },
] as const
