import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * **One face, every route.** Inter carries the whole product — the 25 customer routes and
 * the 26 owner-console routes alike.
 *
 * ## What this replaced, and why it was wrong
 *
 * Three loaders used to sit here: DM Sans, Bricolage Grotesque and Instrument Serif. Two
 * of the three were **never rendered by anything**. `--font-display` and `--font-serif`
 * were declared in `@theme` and no component in the repo referenced either, so Bricolage
 * and Instrument were downloaded-on-demand faces with no demand — dead weight carried
 * because the marketing site had them.
 *
 * Worse, DM Sans applied to the customer shell **only**. `[data-shell="customer"]` set
 * `font-family` directly, so the console inherited Tailwind's system stack and rendered in
 * whatever the visitor's OS happened to supply — Segoe UI on Windows, San Francisco on a
 * Mac, Roboto on Android. Half the product had no typeface of its own and looked different
 * on every machine. Measured before the change: `getComputedStyle(html).fontFamily` was
 * `-apple-system, …, "Segoe UI", …` while `body` under the customer wrapper was DM Sans.
 *
 * ## The mechanism is `--font-sans`, not a `font-family` declaration
 *
 * `globals.css` sets `--font-sans` inside `@theme`. Tailwind's preflight declares
 * `font-family: var(--default-font-family)` on `html, :host`, and `--default-font-family`
 * resolves `--font-sans` at `:root` — the same element `inter.variable` lands on. So one
 * token reaches every route, and the customer shell no longer needs a `font-family`
 * override at all.
 *
 * That resolution order is the whole reason this works and is easy to break: if
 * `inter.variable` is ever moved off `<html>` onto a layout's `<div>`, `--font-sans`
 * computed at `:root` resolves to nothing and the entire app silently falls back to the
 * system stack — the exact bug that was here before, in a new costume.
 *
 * Inter is loaded variable (no `weight`), so 400/500/600/700 all come from one file and
 * the scale in `globals.css` can use any of them at no extra cost.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tho — book a salon in Bhutan",
    template: "%s · Tho",
  },
  description:
    "Book your chair or join the walk-in queue at salons and barbers across Bhutan.",
  applicationName: "Tho",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // The owner console's canvas. `app/(customer)/layout.tsx` overrides this with the
  // cream one for the customer routes.
  themeColor: "#ffffff",
  // Light only — DESIGN.md has no dark mode.
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
