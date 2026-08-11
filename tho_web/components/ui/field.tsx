"use client";

import { useId } from "react";
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
  value,
  onChange,
  type = "text",
  suffix,
  ...rest
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  suffix?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-caption text-muted block font-medium">
        {label}
      </label>
      <span
        className={cn(
          "border-hairline mt-xs bg-canvas flex items-center rounded-sm border",
          "focus-within:border-ink focus-within:border-2",
        )}
      >
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          className="text-body-md text-ink placeholder:text-muted-soft px-md min-h-12 w-full bg-transparent outline-none"
          {...rest}
        />
        {suffix}
      </span>
      {hint ? (
        <p id={hintId} className="text-caption-sm text-muted mt-xxs">
          {hint}
        </p>
      ) : null}
    </div>
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
