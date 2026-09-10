"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { APP_STORE_URL, PLAY_STORE_URL, storeUrlFor } from "@/lib/app-links";
import { queueLinkFor } from "@/lib/queue-deep-link";
import { useMobilePlatform } from "./use-mobile-platform";

/**
 * The app hand-off on a scanned queue link — *"open this in Tho, or go and get Tho"*.
 *
 * ## Why this exists when the operating system already does it
 *
 * It is worth being precise, because the obvious reading of this component is that it
 * duplicates the App Links and Universal Links this domain already serves. It does not.
 * Those fire when the OS resolves `https://bhutansalons.com/q/<id>` **before** a browser
 * gets it, and when they fire nobody ever sees this component — the app is already open.
 *
 * This is for the cases where they demonstrably did not fire, which is the only reason
 * there is a web page on screen to render it on. `lib/app-links.ts` lists them; the one
 * that matters commercially is the **in-app browser**, because a queue link forwarded on
 * WhatsApp — the way these actually spread here — opens in a webview that ignores App
 * Links entirely.
 *
 * ## What each control does, and why there are three
 *
 * - **Open in the Tho app** uses the custom scheme (`bhutansalons://q/<id>`), which is the
 *   one form that needs no hosted file and no OS verification. It is a plain anchor rather
 *   than a scripted `location` assignment on purpose: a browser asked to follow an
 *   unhandled scheme from a link quietly does nothing, whereas the scripted form throws up
 *   *"Safari cannot open the page because the address is invalid"* — an error dialog about
 *   a failure the customer cannot act on and did not cause.
 * - **Get the app** goes to the one store this device can actually install from.
 *   `storeUrlFor` returns null for a platform this cannot identify, and then **both**
 *   listings are offered rather than one guessed — sending an Android user to an
 *   iPhone-only listing is a dead end wearing a working button's clothes.
 * - **Continue in browser** dismisses. It is not a courtesy: the web join is a complete,
 *   working feature that a customer standing at the counter may reasonably prefer, and
 *   AGENTS.md is explicit that `/q/<id>` joining in the browser must keep working. A modal
 *   with no way past it would break that.
 *
 * ## It opens by itself, and only on a phone
 *
 * The brief asked for a popup, and a popup is right *here* — somebody scanning a poster in
 * a shop wants the fastest route into the line, and on a phone that is the app. On a
 * desktop it would be noise: there is no Tho build to install, so `platform === null`
 * renders nothing at all rather than a prompt nobody can act on.
 *
 * **Open is derived, never set in an effect.** `useMobilePlatform` resolves during render
 * (see its note on `useSyncExternalStore`), so `platform !== null && !dismissed` is enough
 * and there is no mount effect to trip `react-hooks/set-state-in-effect`. The server
 * snapshot is null, so the server renders nothing and the sheet appears on hydration.
 *
 * Dismissal is **not** persisted. It was tempting to remember it per session, and it is
 * wrong: re-scanning the poster is a deliberate act by somebody standing in front of it,
 * and the second scan is exactly when "I should just get the app" lands. A remembered
 * dismissal would silence the offer precisely when it is most wanted.
 */
export function OpenInApp({
  businessId,
  salonName,
}: {
  businessId: string;
  /** Named in the copy so the sheet is about *this* shop, not about software. */
  salonName: string;
}) {
  const platform = useMobilePlatform();
  const [dismissed, setDismissed] = useState(false);

  // Nothing to offer a desktop: there is no Tho build for it, and the web join below is
  // already the whole product on this platform.
  if (platform === null) return null;

  const appLink = queueLinkFor(businessId);
  const store = storeUrlFor(platform);

  return (
    <>
      {/*
        What is left on the page once the sheet has been dismissed — and somebody dismisses
        by reflex, which is what people do to a sheet that appears under their thumb. So
        both routes stay reachable without scanning again.

        **Both are real links, and neither reopens the sheet.** An earlier version made this
        a button labelled "Open in the Tho app" that only reopened the dialog, which is a
        control whose label describes something it does not do — the press it invites lands
        on a second surface asking the same question again.
      */}
      <div className="gap-2 mb-base flex flex-col">
        <a
          href={appLink}
          className="border-hairline-soft bg-surface-soft px-base gap-2 flex min-h-12 w-full items-center justify-center rounded-md border"
        >
          <Icons.mobileApp
            style={{ width: IconSize.xs, height: IconSize.xs }}
            aria-hidden
          />
          <span className="text-title font-medium">Open in the Tho app</span>
        </a>
        {/* Only when there is one store to name. An unidentified platform gets the choice
            of both, and that belongs in the sheet rather than in a one-line link. */}
        {store ? (
          <a
            href={store}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption-sm text-muted text-center underline"
          >
            Don&apos;t have it? Get the app
          </a>
        ) : null}
      </div>

      <Sheet
        open={!dismissed}
        onClose={() => setDismissed(true)}
        title={`Join the line at ${salonName}`}
        footer={
          <Button variant="quiet" fullWidth onClick={() => setDismissed(true)}>
            Continue in browser
          </Button>
        }
      >
        <div className="gap-base flex flex-col">
          <p className="text-body-md text-muted">
            The Tho app keeps your place in the line on screen and tells you when it is
            your turn. This page can show you the line, but it cannot notify you.
          </p>

          {/*
            An anchor, not a button with an onClick — see the note above on why the
            scripted form produces an error dialog when the app is absent.

            No `target="_blank"`: a custom scheme opened into a new tab leaves an empty
            tab behind on every browser that honours it.
          */}
          <a
            href={appLink}
            className="bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed gap-2 flex min-h-12 items-center justify-center rounded-sm px-4 text-title font-medium"
          >
            <Icons.mobileApp
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            Open in the Tho app
          </a>

          <div className="gap-2 flex flex-col">
            <p className="text-caption-sm text-muted text-center">
              Don&apos;t have it yet?
            </p>

            {store ? (
              <a
                href={store}
                target="_blank"
                rel="noopener noreferrer"
                className="border-hairline text-ink bg-canvas hover:bg-surface-soft gap-2 flex min-h-12 items-center justify-center rounded-sm border px-4 text-title font-medium"
              >
                <Icons.download
                  style={{ width: IconSize.xs, height: IconSize.xs }}
                  aria-hidden
                />
                Get the app — it&apos;s free
              </a>
            ) : (
              /*
                Unreachable while `platform` is non-null, since `storeUrlFor` answers for
                both. Kept because the two are independent: if a third platform is ever
                detected, the honest failure is "here are both listings", not a missing
                button or a guess.
              */
              <div className="gap-2 flex flex-col">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-hairline text-ink bg-canvas hover:bg-surface-soft flex min-h-12 items-center justify-center rounded-sm border px-4 text-title font-medium"
                >
                  App Store
                </a>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-hairline text-ink bg-canvas hover:bg-surface-soft flex min-h-12 items-center justify-center rounded-sm border px-4 text-title font-medium"
                >
                  Google Play
                </a>
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
