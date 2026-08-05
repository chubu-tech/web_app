import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  DM_Sans,
  Instrument_Serif,
} from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * The three faces the **customer** shell renders in, mirroring the marketing site.
 *
 * ## They have to be declared here, and they only apply over there
 *
 * Only `<html>` can carry a font className, so all three load in the root layout — but
 * nothing here applies them. `[data-shell="customer"]` in `globals.css` sets
 * `font-family` for the customer routes; the owner console inherits the system stack it
 * has always had.
 *
 * `--font-display` in `@theme` resolves `var(--font-bricolage)` **because both land on
 * `<html>`** — `:root` and next/font's generated class are the same element. If these
 * classNames are ever moved down onto a layout's `<div>`, `--font-display` computed at
 * `:root` resolves to nothing and every `font-display` element silently falls back.
 *
 * ## Inter used to be here and was never rendered
 *
 * The removed loader declared `--font-inter` with a comment claiming `globals.css` owned
 * the stack. Nothing in the repo referenced that variable: Tailwind's
 * `--default-font-family` resolved to its own system stack, so **tho_web has never
 * rendered in Inter** on any route — it has always been on the OS font. The variable was
 * a link that was never made. Deleted rather than wired up, because the owner console is
 * meant to keep looking exactly as it does.
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

// Accent faces: one hero heading and a few italic words. `preload: false` keeps them off
// the critical path of the 26 owner routes, which never render either of them.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
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
      className={`${dmSans.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
