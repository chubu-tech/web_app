import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Container } from "@/components/marketing/ui/section";

/**
 * The reading shell for the four public documents — `/help`, `/legal/terms`,
 * `/privacy` and `/legal/content-policy`, which are exactly the four links in the
 * marketing footer's **Legal** column.
 *
 * ## Why this exists: three of the four were rendering the product
 *
 * `/help`, `/legal/terms` and `/legal/content-policy` used to live under
 * `app/(customer)/`, so a visitor who reached the bottom of the landing page and
 * pressed "Terms of Service" was handed the **customer app's** header and footer —
 * a nav offering Bookings, Messages and Saved to somebody who had not signed in and
 * was reading a policy. `/privacy` was the only one of the four that got the public
 * site, and it got it by mounting `SiteHeader`/`SiteFooter` inside the page itself.
 * All four now arrive here instead, and the header and footer are mounted once.
 *
 * ## A nested route group, so not one URL moved
 *
 * `(documents)` contributes no path segment, exactly as `(marketing)` and
 * `(customer)` do not. `app/(marketing)/(documents)/legal/terms/page.tsx` is still
 * `/legal/terms`. That matters more than usual here: `/privacy` is the URL both app
 * stores have on file, `/legal/terms` and `/legal/content-policy` are what
 * `TermsGate` and `ReportSheet` link to from inside the product, and `next.config.ts`
 * permanently redirects `/legal/privacy` to `/privacy`. A rename would have broken
 * all of it.
 *
 * ## Three consequences of leaving `(customer)`
 *
 * 1. **No `requireLiveAccount()`.** These pages no longer call it, so they no longer
 *    read cookies and are statically rendered — which is the right shape for a
 *    document a store reviewer opens signed out. It also means a *suspended* account
 *    can still read the terms it is being judged against.
 * 2. **`data-shell` comes from the parent, not from here.** This used to read "no
 *    `data-shell`", on the grounds that the marketing group carried none and these
 *    therefore rendered on white. `app/(marketing)/layout.tsx` declares
 *    `data-shell="marketing"` now — closing the seam where `/` was `#ffffff` and every
 *    product route was `#f6f3ee` — and these four nest inside it, so they inherit the
 *    cream with nothing to add here. The pages were already restyled onto the marketing
 *    type scale; the words are untouched by any of it.
 * 3. **No `error.tsx`/`loading.tsx` above them any more.** Neither is missed: all
 *    four are static, read nothing and have nothing to fail or to wait for. If a
 *    marketing boundary is ever added it belongs at `app/(marketing)/`, where the
 *    landing page's salon fetch actually needs one.
 *
 * ## The measure and the clearance
 *
 * 46rem (736px) is `/privacy`'s own measure, kept for all four so the set reads as
 * one document family — around 75 characters at `--text-body-lg`. The top padding
 * clears the bar off `--site-header-height` rather than a guessed `pt-28`, because
 * `SiteHeader` is `position: fixed` and reserves no height for anything beneath it.
 *
 * ## Each page's `<article>` carries a `scroll-mt`, and it is not decoration
 *
 * Arriving here from **inside the product** — the customer footer links to all four —
 * is a navigation between two top-level route groups, and Next scrolls the changed
 * segment into view. `shouldSkipElement` passes over the progress line and the header
 * because both are `position: fixed`, so the target is the page's own root element:
 * the `<article>`. Measured, on a build: `article.scrollIntoView()` lands at scrollY
 * 136, which puts the `<h1>` at viewport 0 — **underneath a bar that is 80px tall**.
 * `main.scrollIntoView()` lands at 0, which is why coming from `/` is fine and coming
 * from `/discover` was not.
 *
 * So `scroll-mt-[calc(var(--site-header-height)+1.5rem)]` goes on the `<article>` of
 * every page in this group — the same expression `Section` uses on the landing page's
 * anchored headings, for the same reason. It cannot live here: `scroll-margin` applies
 * to the element that is scrolled into view, and that element is the page's, not the
 * layout's. A fifth document needs the class too.
 */
export default function DocumentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="flex-1 pt-[calc(var(--site-header-height)+2.5rem)] pb-20 sm:pt-[calc(var(--site-header-height)+3.5rem)]"
      >
        <Container>
          <div className="mx-auto max-w-[46rem]">{children}</div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
