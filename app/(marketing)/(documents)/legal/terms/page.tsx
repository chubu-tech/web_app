import type { Metadata } from "next";
import { TERMS_OF_SERVICE } from "@/lib/legal";
import { TERMS_VERSION } from "@/lib/api/moderation";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when you use Tho.",
};

/**
 * The Terms — the exact text `accept_terms` records agreement to.
 *
 * **One document, one source.** The copy is in `lib/legal.ts` because the terms gate has
 * to link to precisely what it is asking somebody to accept, and `TERMS_VERSION` has to
 * identify that same text. A second copy inside this page is how the two drift apart.
 *
 * The version is printed at the foot rather than hidden in a comment: somebody who
 * accepted version 1 and is later re-prompted should be able to see which is which.
 *
 * **It renders in the public site's shell, not the product's** — see
 * `(documents)/layout.tsx`. The words are byte-for-byte what they were under
 * `app/(customer)/`; only the type scale moved, from the product's `display-xl`/`body-md`
 * onto the marketing `editorial-lg`/`body-lg`, so the four Legal links in the footer read
 * as one family. `TermsGate` still links here from inside the app, which is the one path
 * that now crosses shells — and it is a document either way.
 */
export default function TermsPage() {
  return (
    <article className="scroll-mt-[calc(var(--site-header-height)+1.5rem)]">
      <h1 className="text-editorial-lg font-semibold">Terms of Service</h1>

      <div className="bg-hairline-soft mt-10 h-px" />

      {TERMS_OF_SERVICE.map((section, i) => (
        <section key={section.heading ?? `s${i}`} className="mt-12 first:mt-10">
          {section.heading ? (
            <h2 className="text-ink text-heading leading-snug font-semibold">
              {section.heading}
            </h2>
          ) : null}
          {section.body.split("\n\n").map((paragraph, j) => (
            <p
              key={j}
              className="text-body mt-4 text-body-lg leading-relaxed first:mt-0"
            >
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="text-muted border-hairline-soft mt-14 border-t pt-8 text-ui">
        Version {TERMS_VERSION}
      </p>
    </article>
  );
}
