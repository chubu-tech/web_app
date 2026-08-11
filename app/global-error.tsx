"use client";

/**
 * The last resort — a failure in the **root layout itself**, where nothing else is left standing.
 *
 * `error.tsx` does not wrap the layout in its own segment, so the three shell boundaries cannot
 * catch a throw from `app/layout.tsx`, from `app/(customer)/layout.tsx`'s `requireLiveAccount()`,
 * or from the owner and staff layouts' context reads. Those land here.
 *
 * ## Why this file uses inline styles and not one Tailwind class
 *
 * `global-error` **replaces the root layout**, so it renders its own `<html>` and `<body>` and
 * arrives without the stylesheet, the font variable or the `data-shell` wrapper that every
 * other surface in this app takes for granted. A `bg-canvas` here would resolve to nothing and
 * the page would be unstyled black-on-white — which is exactly the state somebody hits when the
 * app is already in trouble, so it is the one place worth not depending on the cascade at all.
 *
 * Importing `globals.css` here would usually work and is what the docs suggest. It is
 * deliberately not done: the whole point of this boundary is that the layout above it failed,
 * and a boundary that needs the same pipeline that just broke is a boundary with a shared
 * failure mode. Inline styles cannot fail separately from the markup they are on.
 *
 * The values are the tokens by hand: `#f6f3ee` is `--color-canvas` on the customer shell,
 * `#1c1917` is `--color-ink`, `#E00B41` is `--color-rausch-cta` (the accessible fill — never
 * `#FF385C`, which fails AA against white).
 *
 * ## `<title>` as a component, not metadata
 *
 * Error boundaries are Client Components and cannot export `metadata`, so the tab name is
 * React's own `<title>`. Without it the tab shows the URL, which is a poor thing to be looking
 * at while working out what went wrong.
 *
 * ## No wordmark and no navigation
 *
 * Both would need the layout that is gone. A reload is the only honest action, which is why it
 * is the only one offered — and `unstable_retry` is what re-fetches rather than merely
 * re-rendering the same broken output.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f6f3ee",
          color: "#1c1917",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <title>Something went wrong · THO</title>
        <main style={{ maxWidth: "34rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 12px", lineHeight: 1.3 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, margin: "0 0 24px", opacity: 0.7 }}>
            THO couldn&apos;t load. This is on our side, not yours — trying again often fixes it.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              minHeight: "48px",
              padding: "0 24px",
              border: 0,
              borderRadius: "999px",
              background: "#E00B41",
              color: "#fff",
              fontSize: "0.9375rem",
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                fontSize: "0.8125rem",
                margin: "16px 0 0",
                opacity: 0.45,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
