import type { Metadata } from "next";
import Link from "next/link";
import { QrScanner } from "@/components/customer/qr-scanner";
import { Icons, IconSize } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Scan a queue QR",
  description: "Scan a salon's walk-in code to take a place in its line.",
  // A camera viewfinder is not a page anybody should arrive at from a search result.
  robots: { index: false, follow: false },
};

/**
 * Scan a shop's walk-in QR — a port of `customer/queue/scan_screen.dart`.
 *
 * **Worth knowing before touching this: the Flutter app disables its own scanner on the web.**
 * `customer_home.dart:72-75` hides the entry point on `kIsWeb` and `_explainScanUnavailable`
 * says *"Scanning needs the app"*, because `mobile_scanner` has no web implementation there. So
 * this route is not a port of behaviour Flutter-web has — it is the gap that message describes,
 * filled with `getUserMedia` and a decoder, which a browser genuinely can do.
 *
 * It is also, honestly, the least load-bearing thing in this batch. A phone's own camera app
 * opens `https://<host>/q/<id>` directly, and that is what the printed poster is for — so most
 * people will never come through here. It exists because a customer already **in** the browser,
 * with the site open, should not have to leave it and re-find the shop; and because a laptop
 * user who is handed a code has somewhere to be told plainly that this is not the way.
 *
 * **Not a `destinations.ts` entry**, for the reason the cart and the queue are not: it is
 * contextual chrome for a thing you do once, not a place to be. It is reached from Discover's
 * control row, which is where the app puts it too.
 */
export default function ScanPage() {
  return (
    <div className="px-base py-lg tablet:px-lg mx-auto w-full max-w-[560px]">
      <Link
        href="/discover"
        className="text-caption text-muted hover:text-ink gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        Discover
      </Link>
      <h1 className="text-display-xl text-ink mb-xs font-semibold">Scan a queue QR</h1>
      <p className="text-body-md text-body mb-lg">
        Salons that take walk-ins put a code on the counter. Scanning it takes you straight to
        that shop&apos;s line.
      </p>

      <QrScanner />
    </div>
  );
}
