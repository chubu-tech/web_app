"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { BHUTAN_CALLING_CODE, BHUTAN_LOCAL_DIGITS, bhutanPhoneError } from "@/lib/bhutan-phone";

/**
 * The product's one phone input — a port of
 * `../tho/app/lib/ui/widgets/bhutan_phone_field.dart`.
 *
 * **`+975` is a fixed label, not something to type.** Every phone field here is a Bhutan
 * number, so asking for a country code only invites it being got wrong or typed twice. The
 * person enters the 8 local digits they would read off a shopfront.
 *
 * **Errors appear on blur, not on the second keystroke.** A message saying "6 more digits to
 * go" while somebody is on their second digit is noise, and it makes the field feel like it
 * is arguing. It clears the moment the number becomes valid, so a corrected field goes quiet
 * without waiting for another blur. `showError` lets a submit handler force the message for a
 * field the person never focused.
 *
 * **The value handed out is what was typed**, digits only — the caller converts with `toE164`
 * when it saves, which is the one place that decision belongs.
 */
export function BhutanPhoneField({
  label = "Phone",
  value,
  onChange,
  required = false,
  showError = false,
  hint,
}: {
  label?: string;
  /** The local digits, as typed. */
  value: string;
  onChange: (value: string) => void;
  /**
   * Whether an empty field is a missing answer.
   *
   * Defaults to false, because most of these fields genuinely are optional — a walk-in who
   * will not leave a number still gets booked. It changes what *empty* means and nothing
   * else: a half-typed number is a typo either way.
   */
  required?: boolean;
  /** Force the message for a field the person never focused, from a submit handler. */
  showError?: boolean;
  hint?: string;
}) {
  const [touched, setTouched] = useState(false);
  const error = bhutanPhoneError(value, { required });

  return (
    <Field
      label={label}
      value={value}
      // Digits only, capped at the local length: there is no valid keystroke past the eighth,
      // and silently ignoring it beats an error for something the field could have refused.
      onChange={(next) => onChange(next.replace(/[^0-9]/g, "").slice(0, BHUTAN_LOCAL_DIGITS))}
      onBlur={() => setTouched(true)}
      error={touched || showError ? error : null}
      hint={hint}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="17 12 34 56"
      prefix={
        <span className="pl-md pr-sm gap-sm flex items-center">
          <span className="text-body-md text-muted tabular-nums">+{BHUTAN_CALLING_CODE}</span>
          {/* A hairline rule rather than a gap: it says the code is part of the field and not
              a value somebody typed. */}
          <span className="bg-hairline h-[22px] w-px" aria-hidden />
        </span>
      }
    />
  );
}
