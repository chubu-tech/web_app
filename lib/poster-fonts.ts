import { Archivo_Black, Manrope } from "next/font/google";

/**
 * The two families the poster design asks for, and they are **only** the poster's.
 *
 * `Tho QR Poster.dc.html` loads Manrope (400–800) and Archivo Black from Google Fonts in its
 * own `<helmet>`. Neither is one of this app's families — the product is Inter with Fraunces
 * for headings (`app/layout.tsx`) — and neither should become one: a poster is a print
 * artefact with its own voice, not a new tier in the type scale.
 *
 * **Declared here rather than in the root layout**, which is the whole point of the file.
 * `next/font/google` must be called at module scope, and a call in `app/layout.tsx` would
 * put two extra families on the critical path of all 80 routes to serve one printable page.
 * Imported by the poster alone, Next scopes the `@font-face` CSS to the route that pulls it
 * in, so a customer browsing Discover never fetches Archivo Black.
 *
 * `display: "swap"` on both: this is a page somebody opens in order to press Print, so text
 * that is briefly in a fallback beats text that is briefly absent. The one real consequence
 * is the headline — Archivo Black is very heavy and its fallback is not, so a print fired
 * before the swap would set *"SCAN TO BOOK"* in the wrong weight. `document.fonts.ready` is
 * awaited before `window.print()` for exactly that reason; see `salon-qr-posters.tsx`.
 */

export const manrope = Manrope({
  variable: "--font-poster-body",
  subsets: ["latin"],
  // Variable font, so 400–800 all come from one file — the design uses 500, 600, 700 and 800.
  display: "swap",
});

export const archivoBlack = Archivo_Black({
  variable: "--font-poster-display",
  subsets: ["latin"],
  // Archivo Black ships one weight only, and `next/font` requires it to be named.
  weight: "400",
  display: "swap",
});

/** Both variables, for the poster's root element. */
export const posterFontClass = `${manrope.variable} ${archivoBlack.variable}`;
