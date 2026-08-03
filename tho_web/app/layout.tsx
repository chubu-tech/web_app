import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Inter, the app's one typeface (`tokens.dart:138` — the bundled Inter variable
 * font). Loaded as a CSS variable so `globals.css` owns the font stack.
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
  themeColor: "#ffffff",
  // Light only — DESIGN.md has no dark mode; the canvas is always pure white.
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-canvas text-ink flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
