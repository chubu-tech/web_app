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
 */
export default function TermsPage() {
  return (
    <article>
      <h1 className="text-display-xl text-ink font-semibold">Terms of Service</h1>

      {TERMS_OF_SERVICE.map((section, i) => (
        <section key={section.heading ?? `s${i}`} className="mt-lg">
          {section.heading ? (
            <h2 className="text-display-sm text-ink mb-sm font-semibold">
              {section.heading}
            </h2>
          ) : null}
          {section.body.split("\n\n").map((paragraph, j) => (
            <p key={j} className="text-body-md text-body mt-md first:mt-0">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="text-caption text-muted border-hairline-soft mt-xl pt-lg border-t">
        Version {TERMS_VERSION}
      </p>
    </article>
  );
}
