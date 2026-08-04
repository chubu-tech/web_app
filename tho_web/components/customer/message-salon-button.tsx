"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { GuestWall } from "@/components/auth/guest-wall";
import { ActionCircle } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { startConversation } from "@/lib/api/chat";
import { createClient } from "@/lib/supabase/client";

/**
 * "Message" in the salon page's action row — a port of `_message` in
 * `tho/app/lib/customer/business_detail_screen.dart:167`, which the web's action row has
 * been missing.
 *
 * **The session is read at press time, never taken from a prop.** This first took the
 * server-rendered account state, and it was wrong on the path that matters most: a guest
 * session is minted *client-side* by the first action that needs one (favouriting a salon),
 * so a page rendered before that still says "anonymous" and the button sent a guest to
 * `/sign-in` instead of showing the wall — losing their place for no reason. `getUser()`
 * cannot go stale. Same shape as `join-queue-form.tsx`.
 *
 * Three outcomes, and the distinction between the first two is the point:
 *
 * - **No session** → `/sign-in`. The wall upgrades an *anonymous session* in place, so
 *   someone with nothing to upgrade cannot use it.
 * - **A guest** → the wall, at the point of action. `conversations_insert` requires
 *   `private.is_real_user()`, and messaging a salon commits someone to a conversation a
 *   human has to answer — the line THO-24 drew.
 * - **Registered** → open or reuse the thread and go to it.
 */
export function MessageSalonButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [wallSession, setWallSession] = useState<number | null>(null);
  /** Set when the wall was opened by pressing Message, so an upgrade resumes the action. */
  const resumeAfterWall = useRef(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push(`/sign-in?next=${encodeURIComponent(`/salon/${businessId}`)}`);
        return;
      }
      if (user.is_anonymous) {
        resumeAfterWall.current = true;
        setWallSession((n) => (n ?? 0) + 1);
        setBusy(false);
        return;
      }

      const conversation = await startConversation(supabase, user.id, businessId);
      router.push(`/messages/${conversation.id}`);
    } catch {
      toast.error("Couldn't open a conversation. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <ActionCircle icon={Icons.chat} label="Message" onClick={open} />
      <GuestWall
        key={wallSession ?? "closed"}
        open={wallSession != null}
        onClose={() => setWallSession(null)}
        action="message"
        next={`/salon/${businessId}`}
        onUpgraded={() => {
          setWallSession(null);
          if (resumeAfterWall.current) {
            resumeAfterWall.current = false;
            void open();
          }
        }}
      />
    </>
  );
}
