import { parseHeading } from "@/lib/marketing/heading";
import { cn } from "@/lib/marketing/utils";
import { Reveal } from "./reveal";
import { TextReveal } from "./text-reveal";

/** Page gutter + max width. Every band shares it so edges line up. */
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
        "mx-auto w-full max-w-[82rem] px-5 sm:px-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small uppercase label with a brand dot. Opens most sections. */
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
        "inline-flex items-center gap-2 text-caption-sm font-semibold tracking-[0.16em] uppercase",
        tone === "light" ? "text-white/65" : "text-muted",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "light" ? "bg-white/80" : "bg-rausch",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

/**
 * Eyebrow + masked display heading + optional lede. Heading accepts the
 * `_accent_` / `|` syntax from `parseHeading`.
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
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl",
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
          "mt-5 text-editorial-lg font-semibold",
          tone === "light" ? "text-white" : "text-ink",
          titleClassName,
        )}
      />
      {body && (
        <Reveal delay={0.12}>
          <p
            className={cn(
              "mt-6 max-w-2xl text-body-lg leading-relaxed",
              align === "center" && "mx-auto",
              tone === "light" ? "text-white/70" : "text-body",
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

/** Vertical rhythm for a page band. */
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
      className={cn("py-24 sm:py-28 lg:py-32", className)}
      // Offset so the sticky nav never covers an anchored heading.
      style={{ scrollMarginTop: "6rem" }}
    >
      {children}
    </section>
  );
}
