import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Where SiteNav's bar can show its full link row: the eight links
        // (seven plus Bookshelf) need roughly 616px at their compact size, and
        // this is the viewport that leaves them clear of the wordmark and the
        // RSVP pill *with* SiteNav's 24px column gap on each side. Below it
        // FloatingNav's hamburger takes over. Shared by both so they can't
        // disagree about who is on screen.
        //
        // History says don't trust arithmetic here (at 840px the seven-link row
        // once needed 865px), so 960 is computed from the old measured 880 plus
        // the Bookshelf link (~74px) and one more column gap, rounded up to
        // keep a little slack for a long guest first name. A ninth link or a
        // longer label spends what's left — measure the right-edge gap in a
        // real browser before adding either.
        nav: '960px',
      },
      colors: {
        lily: '#bb98b0',
        zeus: '#29241f',
        buccaneer: '#69313e',
        rosewood: '#8e5164',
        soyabean: '#695a4a',
        peach: '#ffcadb',
        cream: '#fff4f8',
        gold: '#c8a25e',
        fern: '#5f8f6a',
        // The 'no' beside fern's 'yes', on /admin/guest-summary's dots. A
        // desaturated brick rather than a stock alarm red, which on a page of
        // pink and gold would be the loudest thing on it by a distance — and
        // declining an event is a normal answer, not an error. Kept off
        // rosewood's hue on purpose: rosewood is this page's structural accent,
        // in its headings, rules and chips, so a rosewood dot would read as
        // chrome rather than as a verdict.
        clay: '#b0574f',
        // FSSAI's own mark colours, used verbatim by DietBadge. A guest should be
        // able to match these against a printed menu, so they don't get tuned to
        // the palette the way the colours above it are.
        fssai: { green: '#00a651', brown: '#944a28' },
      },
      fontFamily: {
        display: ['"Playfair Display"', ...defaultTheme.fontFamily.serif],
        body: ['"Inter"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
} satisfies Config
