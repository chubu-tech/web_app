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
 */
export default function ContentPolicyPage() {
  return (
    <article>
      <h1 className="text-display-xl text-ink font-semibold">Content policy</h1>
      <p className="text-body-md text-body mt-base">{CONTENT_POLICY_INTRO}</p>

      <ul className="gap-lg mt-xl flex flex-col">
        {CONTENT_RULES.map((rule) => (
          <li key={rule.title} className="gap-base flex items-start">
            <Icons.close
              className="text-error-text mt-1 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            <div>
              <h2 className="text-title text-ink font-semibold">{rule.title}</h2>
              <p className="text-body-sm text-body mt-xxs">{rule.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="border-hairline-soft mt-xl pt-lg border-t">
        <h2 className="text-display-sm text-ink font-semibold">
          What happens when you report
        </h2>
        <p className="text-body-md text-body mt-sm">{WHAT_HAPPENS_WHEN_YOU_REPORT}</p>
      </section>
    </article>
  );
}
