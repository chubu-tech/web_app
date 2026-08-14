import type { Metadata } from "next";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  CONTENT_POLICY_INTRO,
  CONTENT_RULES,
  WHAT_HAPPENS_WHEN_YOU_REPORT,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Content policy",
  description: "What can't be posted on Tho, and what happens when you report something.",
};

/**
 * What may not be posted — a port of `moderation/content_policy.dart`.
 *
 * This is the document Google Play requires an app carrying user content to have: it
 * *defines* the objectionable content that the Terms then *prohibit*. The two are a pair,
 * and neither works alone — which is why the Terms link here and the terms gate links to
 * both.
 *
 * The nine rules are the same nine `report_reason` values the report sheet offers, in the
 * same order, because a reason somebody can pick and a rule nobody wrote down would be a
 * moderator's problem rather than a reporter's.
 *
 * **The public site's shell, on the marketing type scale** — see `(documents)/layout.tsx`.
 * The nine rules and both blocks of prose are unchanged.
 *
 * `Icons.close` keeps `--color-error-text` rather than taking the site's single rausch
 * accent. Nine identical coral crosses would spend the page's one accent colour on
 * decoration, and a prohibition is the one thing on this site that genuinely is an error
 * state.
 */
export default function ContentPolicyPage() {
  return (
    <article className="scroll-mt-[calc(var(--site-header-height)+1.5rem)]">
      <h1 className="text-editorial-lg font-semibold">Content policy</h1>

      <p className="text-body mt-6 text-body-lg leading-relaxed">
        {CONTENT_POLICY_INTRO}
      </p>

      <div className="bg-hairline-soft mt-10 h-px" />

      <ul className="mt-10 flex flex-col gap-7">
        {CONTENT_RULES.map((rule) => (
          <li key={rule.title} className="flex items-start gap-4">
            <Icons.close
              className="text-error-text mt-1 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            <div>
              <h2 className="text-ink text-subheading font-semibold">
                {rule.title}
              </h2>
              <p className="text-body mt-1.5 text-body-lg leading-relaxed">
                {rule.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <section className="border-hairline-soft mt-14 border-t pt-10">
        <h2 className="text-ink text-heading leading-snug font-semibold">
          What happens when you report
        </h2>
        <p className="text-body mt-4 text-body-lg leading-relaxed">
          {WHAT_HAPPENS_WHEN_YOU_REPORT}
        </p>
      </section>
    </article>
  );
}
