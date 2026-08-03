import { cn } from "@/lib/utils";

/**
 * A section title, ported from `tho/app/lib/ui/widgets/section_header.dart`.
 *
 * `action` takes a node rather than a callback so this stays usable from a server
 * component — the caller supplies a `<Link>` or a button from its own client
 * island. In the app it is always a "See all" at a 44px target; keep that here.
 */
export function SectionHeader({
  title,
  action,
  className,
  as: Tag = "h2",
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        action ? "mb-0" : "mb-sm",
        className,
      )}
    >
      <Tag className="text-display-sm text-ink font-semibold">{title}</Tag>
      {action}
    </div>
  );
}

/** The trailing "See all" treatment, so every section spells it the same way. */
export function seeAllClass() {
  return "text-caption text-rausch-cta inline-flex min-h-11 min-w-11 items-center justify-center px-sm font-medium";
}
