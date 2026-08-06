import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WaitlistProvider } from "@/components/waitlist-provider";
import { brand, hero } from "@/lib/content";

/**
 * **One face, loaded variable.** Inter carries every line on the site, and the same
 * face carries `../tho_web` and the Flutter app — so a visitor moving from this page
 * into the product never crosses a typographic seam.
 *
 * ## Three loaders used to sit here
 *
 * DM Sans for body, Inter Black 900 for the hero `h1`, Instrument Serif for the
 * italic accent word. That is three families and three downloads on a two-route
 * static site, and the h1 at `weight: "900"` was a second Inter file on top of the
 * variable one any other weight would have needed.
 *
 * No `weight` here on purpose: Inter ships variable, so 400/500/600/700 all come out
 * of one file. The scale in `globals.css` can reach for any of them at no extra
 * request, which is what lets hierarchy come from weight instead of from a second
 * family.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE = `https://${brand.domain}`;
const title = `${brand.name} — salon booking & virtual queue in Bhutan`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: title,
    template: `%s · ${brand.name}`,
  },
  description: hero.purpose,
  applicationName: brand.name,
  alternates: { canonical: "/" },
  keywords: [
    "salon booking Bhutan",
    "barber appointment Thimphu",
    "virtual queue app",
    "QR check-in salon",
    "salon management software",
    "book haircut Bhutan",
    "salon queue system",
  ],
  category: "business",
  openGraph: {
    type: "website",
    locale: "en_BT",
    url: SITE,
    siteName: brand.name,
    title,
    description: hero.purpose,
  },
  twitter: { card: "summary_large_image", title, description: hero.purpose },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col overflow-x-hidden">
        <a
          href="#main"
          className="bg-ink focus:ring-rausch sr-only rounded-full px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:ring-2"
        >
          Skip to content
        </a>
        {/*
          The waitlist modal's host. In the root layout rather than on `/`
          because every download call to action can open it and they are spread
          across the header, the hero, the pricing panel and the closing band —
          and because `/waitlist` renders the same form without it.
        */}
        <WaitlistProvider>{children}</WaitlistProvider>
      </body>
    </html>
  );
}
