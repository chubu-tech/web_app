import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { brand, hero } from "@/lib/content";

/* DM Sans carries the whole marketing site: geometric, open, low contrast —
   it holds up at 5rem display sizes without feeling dense. (The Flutter app
   stays on Inter; this page is deliberately the cleaner-typed surface.) */
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

/* The hero headline only. Tighter joins and more character than DM Sans, which
   is what carries a 5rem line; everywhere else would be shouting. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

/* Editorial accent only — the italic emphasis word inside display headings. */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
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
      className={`${dmSans.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col overflow-x-hidden">
        <a
          href="#main"
          className="bg-ink focus:ring-rausch sr-only rounded-full px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:ring-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
