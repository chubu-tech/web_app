import type { Metadata } from "next";
import Link from "next/link";
import { brand, deletion, legal } from "@/lib/marketing/content";

/**
 * `/delete-account` — the URL Google Play's Data safety form asks for.
 *
 * Play wants a page a user can reach **without the app installed**, so the in-app
 * path alone does not satisfy it, and wants that page to state what is removed and
 * what is retained. Apple's requirement is the in-app path (guideline 5.1.1(v)),
 * which the app has; this is the web half, and the one a reviewer clicks.
 *
 * **Top-level, not under `/legal/`,** alongside `/privacy` and `/help`. Terms and the
 * content policy nest under `/legal/` because the product links to them from inside;
 * this one gets filed with Play on the Data safety form, and a URL we hand to a store
 * is a URL we should not later move — the same reason `/privacy` sits where it does
 * and `next.config.ts` has to redirect `/legal/privacy` to it.
 *
 * The header, footer, 46rem measure and clearance under the fixed bar all come from
 * `(documents)/layout.tsx`, and the `scroll-mt` below is the layout's, not decoration
 * — see its note on arriving here from inside the product.
 *
 * Two ordering decisions worth keeping:
 *
 * 1. **In-app first.** It is immediate and self-service; the email route costs the
 *    user a wait and us a manual step.
 * 2. **Email still gets its own section, not a footnote.** The people who need it are
 *    exactly those who can no longer sign in, and burying it would fail them.
 */
export const metadata: Metadata = {
  title: deletion.title,
  description: deletion.description,
  alternates: { canonical: "/delete-account" },
  // Indexable for the same reason as /privacy, and one more: somebody who has already
  // uninstalled the app has only search to find this.
  robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <article className="scroll-mt-[calc(var(--site-header-height)+1.5rem)]">
      <h1 className="text-editorial-lg font-display font-semibold">{deletion.title}</h1>

      <p className="text-body mt-6 text-body-lg leading-relaxed">
        {deletion.lead}
      </p>

      <div className="bg-hairline-soft mt-10 h-px" />

      <section className="mt-10">
        <h2 className="text-ink text-heading leading-snug font-semibold">
          {deletion.inApp.title}
        </h2>
        <ol className="mt-5 flex flex-col gap-3.5">
          {deletion.inApp.steps.map((step, i) => (
            <li
              key={step}
              className="text-body relative pl-8 text-body-lg leading-relaxed"
            >
              <span
                className="text-rausch absolute top-0 left-0 text-title font-semibold tabular-nums"
                aria-hidden
              >
                {i + 1}.
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="text-body mt-5 text-body-lg leading-relaxed">
          {deletion.inApp.footnote}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-ink text-heading leading-snug font-semibold">
          {deletion.byEmail.title}
        </h2>
        {/* The address is split out of the sentence so it can be a mailto with the
            subject prefilled — one less thing for someone already locked out to get
            wrong, and it makes the requests arrive uniformly labelled. */}
        <p className="text-body mt-4 text-body-lg leading-relaxed">
          {deletion.byEmail.body.split(legal.contactEmail).flatMap((part, i) =>
            i === 0
              ? [part]
              : [
                  <a
                    key="mail"
                    href={`mailto:${legal.contactEmail}?subject=Delete%20my%20account`}
                    className="text-rausch underline decoration-from-font underline-offset-2"
                  >
                    {legal.contactEmail}
                  </a>,
                  part,
                ],
          )}
        </p>
      </section>

      {/* The two lists are the substance of the page for a reviewer: one of things
          destroyed, one of things that survive stripped of identity. Different bullet
          colours because they are not the same kind of claim. */}
      <section className="mt-12">
        <h2 className="text-ink text-heading leading-snug font-semibold">
          {deletion.removed.title}
        </h2>
        <ul className="mt-5 flex flex-col gap-3.5">
          {deletion.removed.items.map((item) => (
            <li
              key={item.lead}
              className="text-body relative pl-5 text-body-lg leading-relaxed"
            >
              <span
                className="bg-rausch absolute top-[0.6em] left-0 size-1.5 rounded-full"
                aria-hidden
              />
              <strong className="text-ink font-semibold">{item.lead}</strong>
              {" — "}
              {item.body}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-ink text-heading leading-snug font-semibold">
          {deletion.kept.title}
        </h2>
        <p className="text-body mt-4 text-body-lg leading-relaxed">
          {deletion.kept.body}
        </p>
        <ul className="mt-5 flex flex-col gap-3.5">
          {deletion.kept.items.map((item) => (
            <li
              key={item.lead}
              className="text-body relative pl-5 text-body-lg leading-relaxed"
            >
              <span
                className="bg-hairline absolute top-[0.6em] left-0 size-1.5 rounded-full"
                aria-hidden
              />
              <strong className="text-ink font-semibold">{item.lead}</strong>
              {" — "}
              {item.body}
            </li>
          ))}
        </ul>
        <p className="text-body mt-5 text-body-lg leading-relaxed">
          {deletion.kept.footnote}
        </p>
      </section>

      <p className="text-muted mt-14 text-title">
        <Link href="/privacy" className="hover:text-ink transition-colors">
          Privacy policy
        </Link>
        {" · "}
        <Link href="/" className="hover:text-ink transition-colors">
          {brand.name}
        </Link>{" "}
        · Built in Bhutan, for Bhutan.
      </p>
    </article>
  );
}
