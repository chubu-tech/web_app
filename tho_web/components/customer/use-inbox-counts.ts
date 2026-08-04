"use client";

import { useEffect, useState } from "react";
import { fetchMyConversations } from "@/lib/api/chat";
import { unreadNotificationCount } from "@/lib/api/notifications";
import { unreadThreadCount } from "@/lib/chat-logic";
import { createClient } from "@/lib/supabase/client";
import { usePollTick } from "./use-poll";

export type InboxCounts = { messages: number; notifications: number };

const NONE: InboxCounts = { messages: 0, notifications: 0 };

/**
 * The two unread counts behind the nav badges.
 *
 * **Client-side on purpose.** The shell already does `getAccount()` and a `queue_entries`
 * lookup on every page; two more server reads per navigation to render a small number is
 * the wrong trade. Fetching here costs the server nothing on first paint, and it lets the
 * badge *change* while someone sits on a page — a salon's reply shows up in the nav without
 * a reload, which is the whole point of a badge.
 *
 * Polls every **30s**: slower than the thread's 3s because nobody is watching the nav, and
 * it stops in a hidden tab like every other poll here.
 *
 * **Nothing is fetched unless the caller says the reader is registered.** A guest holds no
 * thread (`conversations_insert` needs a real user) and receives no notification, so a
 * request for either would be two round trips for two guaranteed zeroes.
 */
export function useInboxCounts(enabled: boolean): InboxCounts {
  const [fetched, setFetched] = useState<InboxCounts>(NONE);
  const tick = usePollTick(30_000, !enabled);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const supabase = createClient();

    void (async () => {
      const [notifications, messages] = await Promise.all([
        unreadNotificationCount(supabase).catch(() => null),
        (async () => {
          const { data } = await supabase.auth.getUser();
          if (!data.user) return null;
          const threads = await fetchMyConversations(supabase, data.user.id).catch(() => null);
          return threads == null ? null : unreadThreadCount(threads, data.user.id);
        })(),
      ]);
      // A failed read keeps the last good number rather than showing a zero — a badge
      // that vanishes on a flaky request reads as "you're all caught up", which is worse
      // than a slightly stale count.
      if (!live) return;
      setFetched((prev) => ({
        notifications: notifications ?? prev.notifications,
        messages: messages ?? prev.messages,
      }));
    })();

    return () => {
      live = false;
    };
  }, [enabled, tick]);

  // The disabled case is **derived, not stored**: resetting state in the effect body is
  // what the React compiler rules object to, and rightly — it renders twice to reach a
  // value that was already known.
  return enabled ? fetched : NONE;
}
