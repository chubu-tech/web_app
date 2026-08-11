import type { Metadata } from "next";
import { PRIVACY_SUMMARY } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Tho stores, what a salon can see, and how to remove it.",
};

/**
 * Privacy — and an honest note about what this page is.
 *
 * **The Flutter app has no text to port here**: it opens a hosted URL. Rather than invent
 * a legal document, this states only what the code in this repo can be shown to do — what
 * is stored, what a salon can actually read (which is an RLS question with a definite
 * answer), that nothing leaves the platform, and how to remove it.
 *
 * Every claim on it is checkable against a policy in `../tho/supabase/migrations/`. Do not
 * extend it with anything the schema does not support; that is how a privacy page becomes
 * a liability rather than a disclosure.
 */
export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-display-xl text-ink font-semibold">Privacy</h1>
      <p className="text-body-md text-body mt-base">
        The short version of what Tho stores and who can see it.
      </p>

      {PRIVACY_SUMMARY.map((section) => (
        <section key={section.heading} className="mt-lg">
          <h2 className="text-display-sm text-ink mb-sm font-semibold">{section.heading}</h2>
          <p className="text-body-md text-body">{section.body}</p>
        </section>
      ))}

      <p className="text-body-sm text-muted border-hairline-soft mt-xl pt-lg border-t">
        This is a summary, not the full policy — the complete one is published before
        general release. If anything here matters to a decision you are making, ask us
        first.
      </p>
    </article>
  );
}
