import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";
import { ResubmitSalonButton } from "@/components/owner/resubmit-salon-button";
import { isListed, type Business } from "@/lib/types/salon";

/**
 * Where a salon stands with moderation, and what is left to set up — a port of
 * `SalonSetupHeader` in `../tho/app/lib/business/business_onboarding.dart`.
 *
 * **It lives inside the Insights page's own column, not stacked over it.** Upstream moved it
 * there for a measured reason: a fixed banner held a phone-sized strip of the screen on every
 * visit, and it shortened pull-to-refresh's reach. As the first child of that flex column it
 * inherits the page's gap and costs nothing at all once it collapses.
 *
 * **It collapses to `null` for almost every salon almost all of the time** — a listed salon
 * with services and staff renders nothing.
 *
 * Why any of it is needed: `create_business` starts a salon at `status = 'pending'` and
 * `businesses_select`'s public arm requires `approved`, so a self-served owner has a console
 * and no listing. An owner who is not told that reads an empty diary as a broken app.
 */
export function SalonReviewStatus({
  business,
  hasServices,
  hasStaff,
}: {
  business: Business;
  /**
   * Counts, or `null` when the read failed.
   *
   * **Null hides the checklist rather than showing zero.** A failed count would otherwise
   * tell a salon with a full price list to go and add its services.
   */
  hasServices: boolean | null;
  hasStaff: boolean | null;
}) {
  const notice = statusNotice(business);
  const steps = [
    hasServices === false
      ? {
          key: "services",
          href: "/business/services",
          title: "Add your services",
          blurb: "Prices and how long each one takes",
        }
      : null,
    hasStaff === false
      ? {
          key: "staff",
          href: "/business/staff",
          title: "Add your team",
          blurb: "Each stylist needs working hours before anyone can book",
        }
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  // Deliberately only those two. Opening hours are set by the reviewer, not the owner, so
  // listing them would be a task with no screen behind it.
  const done = 2 - steps.length;

  if (notice == null && steps.length === 0) return null;

  return (
    <div className="gap-md flex flex-col">
      {notice}
      {steps.length > 0 ? (
        <div className="border-hairline bg-canvas overflow-hidden rounded-md border">
          <div className="px-base pt-base pb-sm gap-sm flex items-baseline justify-between">
            <h2 className="text-title text-ink font-semibold">Finish setting up</h2>
            <span className="text-caption-sm text-muted">{done} of 2</span>
          </div>
          <ul>
            {steps.map((step) => (
              <li key={step.key} className="border-hairline-soft border-t">
                <Link
                  href={step.href}
                  className="px-base py-md gap-md hover:bg-surface-soft flex min-h-12 items-center"
                >
                  <span className="text-ink shrink-0">
                    <Icons.add style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-title text-ink block font-medium">{step.title}</span>
                    <span className="text-body-sm text-muted block">{step.blurb}</span>
                  </span>
                  <Icons.forward
                    className="text-muted-soft shrink-0"
                    style={{ width: IconSize.xs, height: IconSize.xs }}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The moderation notice, or `null` when there is nothing to say.
 *
 * Four states, each decided on its own merits — and two of them deliberately offer no action,
 * because the owner genuinely cannot resolve them from here.
 */
function statusNotice(business: Business) {
  if (isListed(business)) return null;

  switch (business.status) {
    case "pending":
      return (
        <Notice tone="quiet" icon="clock" title="Under review">
          Customers can&apos;t find {business.name} yet. We usually decide within a day —
          everything below is yours to set up in the meantime.
        </Notice>
      );
    case "rejected":
      return (
        <Notice tone="error" icon="error" title="Not approved yet" action={<ResubmitSalonButton businessId={business.id} />}>
          {/* The operator's own words when there are any: they name the thing to change, and
              nothing written here could. */}
          {business.rejectionReason?.trim() ||
            "Check your salon details in Settings, then send it back to us."}
        </Notice>
      );
    case "suspended":
      // No action, and that is the point: a suspension is a sanction, so it is not
      // self-liftable. Saying who to ask is the whole of what this can offer.
      return (
        <Notice tone="error" icon="locked" title="Suspended">
          Your salon is hidden from customers. Get in touch and we&apos;ll go through it with
          you.
        </Notice>
      );
    default:
      // `approved` but switched off — an operator action the owner cannot undo in Settings.
      return (
        <Notice tone="quiet" icon="hidden" title="Hidden from customers">
          Your salon is approved but switched off. Get in touch to put it back.
        </Notice>
      );
  }
}

function Notice({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "quiet" | "error";
  icon: keyof typeof Icons;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Glyph = Icons[icon];
  const error = tone === "error";
  return (
    <div
      className={
        error
          ? "bg-error-soft p-base gap-md flex items-start rounded-md"
          : "bg-surface-soft p-base gap-md flex items-start rounded-md"
      }
    >
      <Glyph
        className={error ? "text-error-text mt-0.5 shrink-0" : "text-body mt-0.5 shrink-0"}
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <h2 className={error ? "text-title text-error-text font-medium" : "text-title text-ink font-medium"}>
          {title}
        </h2>
        <p className={error ? "text-body-sm text-error-text mt-xxs" : "text-body-sm text-body mt-xxs"}>
          {children}
        </p>
        {action ? <div className="mt-md">{action}</div> : null}
      </div>
    </div>
  );
}
