"use client";

import { useId } from "react";
import { IconSize, type Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A labelled text input, and a labelled select.
 *
 * There was no form primitive in this kit until 3a, and by then the same twenty lines had
 * been written three times — `components/auth/auth-form.tsx`, `profile-editor.tsx` and
 * `join-queue-form.tsx` each have a private `Field`. The owner console's two forms would
 * have been the fourth and fifth. This is that component, taken from the auth form's
 * version, which is the most complete of the three (it is the only one with a suffix slot).
 *
 * **The three older call sites are deliberately left alone.** They do not merely duplicate
 * this — they differ: 14 versus 12 minimum height, an ink two-pixel focus ring versus a
 * rausch one-pixel one. Converting them would change how three verified screens look for no
 * behavioural gain, so each adopts this the next time it is edited for its own reasons.
 *
 * The label is a real `<label>` bound by id, the hint is wired through `aria-describedby`,
 * and the focus ring lives on the wrapper so it surrounds the suffix button too.
 */

export function Field({
  label,
  hint,
  error,
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
  ...rest
}: {
  label: string;
  hint?: string;
  /**
   * Why this field is wrong, shown under it and reddening its border.
   *
   * **Takes precedence over `hint`** rather than sitting beside it: two lines under one
   * input, one of them telling you what to do and the other what you did wrong, is a field
   * arguing with itself. `aria-describedby` follows whichever is showing, and the error
   * carries `role="alert"` so it is announced when it appears.
   */
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  /**
   * Rendered inside the border, before the input — a fixed unit or dialling code.
   *
   * Note `prefix` is also an HTML global attribute (RDFa), typed `string`, so it has to be
   * omitted from the spread below or the two intersect into `ReactNode & string` and no
   * element is assignable.
   */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type" | "prefix">) {
  const id = useId();
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-caption text-muted block font-medium">
        {label}
      </label>
      <span
        className={cn(
          "mt-xs bg-canvas flex items-center rounded-sm border",
          error ? "border-error-text" : "border-hairline",
          "focus-within:border-ink focus-within:border-2",
        )}
      >
        {prefix}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={messageId}
          aria-invalid={error ? true : undefined}
          className={cn(
            "text-body-md text-ink placeholder:text-muted-soft min-h-12 w-full bg-transparent outline-none",
            // The prefix owns the left inset when there is one, so the digits sit against it
            // rather than a gutter's width away from the code they belong to.
            prefix ? "pr-md" : "px-md",
          )}
          {...rest}
        />
        {suffix}
      </span>
      {error ? (
        <p id={messageId} role="alert" className="text-caption-sm text-error-text mt-xxs">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-caption-sm text-muted mt-xxs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A glyph for [Field]'s `prefix` slot — `_FieldIcon` from
 * `tho/app/lib/auth/email_sign_in_screen.dart`, at its measurements: 12px in from the
 * border, an `sm` (20px) glyph, 8px of air before the text.
 *
 * It lives here rather than in the auth form because the spacing *is* the `prefix`
 * contract. `Field` deliberately gives the input no left padding when a prefix is present
 * (so `+975` can sit against the digits it belongs to), which means every prefix owes the
 * field its whole left inset — a fact worth stating once, next to the prop, rather than
 * rediscovering it per call site with a hand-written pad.
 *
 * Decorative by definition: the `<label>` above already names the field, so a screen
 * reader announcing "person, Your name" would be reading the ornament out loud.
 */
export function FieldIcon({ icon: Icon }: { icon: (typeof Icons)[keyof typeof Icons] }) {
  return (
    <span aria-hidden className="pl-md pr-sm text-muted flex items-center">
      <Icon style={{ width: IconSize.sm, height: IconSize.sm }} />
    </span>
  );
}

export type SelectOption = { value: string; label: string };

/**
 * A labelled `<select>`.
 *
 * A real select rather than a bespoke listbox, for the same reason the calendar uses a
 * native date input: the platform already draws it well on every device, and it is
 * keyboard- and screen-reader-correct without any of it being reimplemented. `SelectTile`
 * remains the right control when the options need media or a subtitle; this is for a plain
 * list of names.
 */
export function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown as a disabled first option while nothing is chosen. */
  placeholder?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-caption text-muted block font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hintId}
        className={cn(
          "border-hairline mt-xs bg-canvas text-body-md text-ink px-md min-h-12 w-full rounded-sm border",
          "focus:border-ink focus:border-2 focus:outline-none",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-caption-sm text-muted mt-xxs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
