import { cn } from "@/lib/utils";

/**
 * A titled card grouping one section of a long settings-style screen — a port of
 * `tho/app/lib/ui/widgets/section_card.dart`.
 *
 * Screens like the staff editor had grown to seven sections rendered as a single flat column:
 * headers, fields, switches and pickers all at one visual level, so nothing said where one
 * subject ended and the next began. A card draws that boundary, and the title travels with the
 * content instead of floating above an unbounded run of it.
 *
 * ## Where this departs from upstream, deliberately
 *
 * The Dart pairs `AppShadows.card` with a hairline border. **That is the ghost card** —
 * `card`'s first layer is a zero-blur 1px spread standing in for a hairline, so a bordered
 * surface using it draws its edge twice. `AppShadows.raised` exists precisely for the case
 * where a surface genuinely needs an edge (no spread layer, so it composes), and this is that
 * case. Same weight on the page, one edge.
 *
 * No `"use client"`: a card is markup, and the settings screens that want it are server
 * components until something in them needs a handler.
 */
export function SectionCard({
  title,
  subtitle,
  trailing,
  children,
  className,
}: {
  /**
   * Omitted for a card that is its own subject — a balance, say, where a label above the number
   * would be noise.
   */
  title?: string;
  /** One line under the title, for the rule that has to be known before the controls make sense. */
  subtitle?: string;
  /** An action belonging to this section, on the title row: Add, Edit, Clear. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("border-hairline bg-canvas shadow-raised p-base rounded-md border", className)}
    >
      {title ? (
        <header className="mb-md">
          <div className="gap-sm flex items-start">
            <h2 className="text-title text-ink min-w-0 flex-1 font-semibold">{title}</h2>
            {trailing ? <div className="shrink-0">{trailing}</div> : null}
          </div>
          {subtitle ? <p className="text-body-sm text-muted mt-xxs">{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
