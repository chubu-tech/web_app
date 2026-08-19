import { parseHeading } from "@/lib/marketing/heading";
import { cn } from "@/lib/marketing/utils";
import { Reveal } from "./reveal";
import { TextReveal } from "./text-reveal";

/**
 * Page gutter + max width. Every band shares it so edges line up.
 *
 * **1280px, down from 1312px** — the reference caps editorial content at ~1280 and
 * lets the gutters absorb the rest above that. The number is written out rather
 * than given a `max-w-*` name on purpose: this repo declares `--spacing-lg`,
 * `--spacing-xl` and friends, and a named width resolves against the spacing
 * namespace *before* `--container-*`, so `max-w-xl` compiles to `max-width: 32px`.
 * See the note in `app/globals.css`.
 */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[80rem] px-5 sm:px-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The small uppercase label that opens a band.
 *
 * The dot is the accent, and it is deliberately the only rausch in most sections —
 * the reference's rule is that the brand colour appears once or twice on a page
 * that is otherwise white and ink.
 */
export function Eyebrow({
  children,
  tone = "ink",
  className,
}: {
  children: React.ReactNode;
  tone?: "ink" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-caption-sm font-semibold tracking-[0.14em] uppercase",
        tone === "light" ? "text-white/70" : "text-muted",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "light" ? "bg-white/80" : "bg-rausch",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

/**
 * Optional eyebrow + masked display heading + optional lede. Heading accepts the
 * `_accent_` / `|` syntax from `parseHeading`.
 *
 * ## The eyebrow is OFF by default, and two of them exist on the whole site
 *
 * Every band on the home page used to pass one — nine of nine, plus the waitlist page —
 * and at that density they stop being labels and become a tic: a page of *labelled
 * lists*, where the small tracked caps say "this is an editorial site" and nothing else.
 * When every section is chaptered, none of them are. The dot beside each one also spent
 * the brand accent nine times on a page whose own rule is that rausch "appears once or
 * twice".
 *
 * Six were cut by asking one question of each — **does the eyebrow say something the
 * heading does not?** Mostly it did not: *"Live right now"* over "Already open for
 * business", *"Who pays what"* over "Customers never pay. Only salons do.",
 * *"Questions"* over "The things everyone asks". Those are the same sentence twice.
 *
 * Two survive because they carry information the heading actively lacks:
 *
 * - **`ForSalons` — "For salon owners".** The one place the page changes who it is
 *   talking to. Everything above it addresses a customer.
 * - **`DownloadBand` — "Coming soon"** (rendered inline there, not through this
 *   component). "The chair is ready when you are" reads as a live download; the app has
 *   not shipped. That is a material fact and the heading hides it.
 *
 * The hero's line is `brand.cities` — a coverage claim in the identity row beside the
 * Dzongkha greeting, not a section label — and is not counted against this.
 *
 * **Before adding a third, cut one.** And keep the stack vertical: the eyebrow sits
 * directly above its heading in the same column. A label in a narrow left column with the
 * heading to its right is the hanging-header pattern, which is the single most reliable
 * templated-editorial tell.
 *
 * **Left-aligned by default, and every band on the page now takes the default.**
 * Three sections used to centre themselves and the rest did not, so the page had no
 * consistent left edge to read down — which is most of what made the scroll feel
 * assembled rather than designed. The reference centres nothing above its footer.
 * `align="center"` is kept for the closing band, which sits over a photograph and
 * genuinely wants it.
 *
 * The heading is 600, not 700. That is the reference's central typographic claim:
 * display weights stay modest because the layout leans on photography and
 * whitespace for hierarchy.
 */
export function SectionHeading({
  eyebrow,
  title,
  body,
  tone = "ink",
  align = "left",
  className,
  titleClassName,
  titleId,
  children,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  tone?: "ink" | "light";
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
  /** Wire this to the section's `aria-labelledby`. */
  titleId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-[44rem]",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <TextReveal
        as="h2"
        id={titleId}
        lines={parseHeading(title)}
        className={cn(
          // Fraunces, as on the hero's h1 — every display heading on the public site
          // speaks in one voice, and this component is where all but one of them are.
          "text-editorial-lg font-display mt-4 font-semibold",
          tone === "light" ? "text-white" : "text-ink",
          titleClassName,
        )}
      />
      {body && (
        <Reveal delay={0.1}>
          <p
            className={cn(
              "text-body-lg mt-4 max-w-[38rem]",
              align === "center" && "mx-auto",
              tone === "light" ? "text-white/75" : "text-body",
            )}
          >
            {body}
          </p>
        </Reveal>
      )}
      {children}
    </div>
  );
}

/**
 * Vertical rhythm for a page band: 56 / 64 / 80px.
 *
 * Down from 96 / 112 / 128. The reference puts major bands at `{spacing.section}`
 * — 64px — and says why: tighter than typical SaaS marketing, "because marketplace
 * pages need higher card density per scroll". This page has a salon grid, a plan
 * grid and a feature list on it, so the same reasoning applies.
 *
 * Read these doubled, because that is how they arrive: two adjacent bands put their
 * padding back to back, so the old numbers meant **192px of empty canvas** between
 * the end of one section and the start of the next at desktop — more than a phone
 * screen. It showed worst under "Near you", which ends in a button and renders no
 * grid until somebody shares a location. 160px is still generous and no longer
 * reads as a gap.
 *
 * `scroll-margin-top` is the header's own token plus a gap, so an anchored heading
 * cannot land underneath the bar. It used to be a hardcoded `6rem` here and `7rem`
 * on one heading in `pricing.tsx`, against a header that is 4.5–5rem.
 */
export function Section({
  id,
  children,
  className,
  "aria-labelledby": ariaLabelledBy,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "scroll-mt-[calc(var(--site-header-height)+1.5rem)] py-14 sm:py-16 lg:py-20",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A full-width hairline between two bands on the same surface. */
export function BandRule({ className }: { className?: string }) {
  return (
    <div
      className={cn("border-hairline-soft border-t", className)}
      aria-hidden
    />
  );
}
