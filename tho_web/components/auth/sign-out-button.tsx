"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign out.
 *
 * `router.refresh()` before navigating, because the shell resolves the account in a
 * server component — without it the nav would keep rendering the signed-in state
 * against a cookie that no longer exists.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outlined"
      fullWidth
      busy={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.refresh();
        router.replace("/");
      }}
    >
      Sign out
    </Button>
  );
}
