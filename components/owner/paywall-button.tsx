"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PaywallSheet } from "@/components/owner/paywall-sheet";
import type { Feature } from "@/lib/entitlements";

/**
 * A button that raises the paywall for one feature.
 *
 * Exists so a **server** component can offer the paywall without becoming a client component
 * itself. 3c has six locked surfaces — insights, client book, products, loyalty, payroll, tax —
 * and every one of them is otherwise static: a page that only needs `useState` for whether a
 * sheet is open should not ship its charts, tables and copy to the browser to get it.
 *
 * The same reasoning as `MessageSalonButton` on the customer side: push the interactivity down
 * to the smallest thing that needs it.
 */
export function PaywallButton({
  feature,
  label,
  variant = "filled",
}: {
  feature: Feature;
  label: string;
  variant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <PaywallSheet open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
}
