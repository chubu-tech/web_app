"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/api/notifications";
import { relativeAge } from "@/lib/chat-logic";
import {
  matchesFilter,
  NOTIFICATION_FILTERS,
  notificationStyle,
  notificationText,
  ownerNotificationText,
  type NotificationFilter,
  type NotificationIconName,
} from "@/lib/notification-copy";
import { createClient } from "@/lib/supabase/client";
import { THIMPHU_TZ } from "@/lib/time";
import { isUnread, type AppNotification } from "@/lib/types/notification";
import { cn } from "@/lib/utils";

/**
 * The inbox, ported from `tho/app/lib/notifications_screen.dart`.
 *
 * **Rows carry a real body**, composed from the payload by `notificationText` — which is
 * the whole point of this pass. The app renders `payload['message']`, a key the server
 * has never written, so on live data its rows show a bare title. That is also why there
 * is no detail route here: the row already holds everything a detail page could show.
 *
 * Read state is optimistic: the row dims the moment it is tapped, and the RPC follows. A
 * failure puts it back rather than leaving the list lying about what has been seen.
 *
 * ## One list, two audiences
 *
 * `audience` is the only thing that differs between the customer's inbox and the salon's, and it
 * changes exactly two things: **the words** and **where a row links**. Everything else — the
 * grouping, the filter chips, the optimistic read, the row layout — is identical, which is why
 * this is one parameterised component where `OwnerConversationList` is a second component: that
 * one differs in four particulars, this one in one.
 *
 * The words matter more than they look. `booking_created` reaching a customer means *"your
 * appointment is set"*; reaching a salon it means *"someone just booked"*. Same row, same
 * payload, opposite readings — see `ownerNotificationText`.
 */
export function NotificationList({
  initial,
  now,
  audience = "customer",
}: {
  initial: AppNotification[];
  /** Whose inbox this is. Decides the copy table and the deep links. */
  audience?: "customer" | "owner";
  /**
   * The render clock, passed in from the server page rather than read here.
   *
   * Relative ages and the TODAY/YESTERDAY boundary both need "now", and reading it
   * during a client render is impure — the React compiler rules say so, and they are
   * right: two renders would disagree. The app's own inbox is equally a snapshot; it
   * computes on build and never ticks.
   */
  now: Date;
}) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [busy, setBusy] = useState(false);
  /**
   * Whether there is anything older to ask for.
   *
   * A full first page means "probably more"; a short one is proof there is nothing else. That
   * is the same test the app makes (`_hasMore = page.length >= pageSize`) and it costs one
   * extra request at the exact multiple — better than a count query on every load.
   */
  const [hasMore, setHasMore] = useState(initial.length >= NOTIFICATIONS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const unread = items.filter(isUnread).length;
  const shown = items.filter((n) => matchesFilter(filter, n));

  /**
   * The next page, appended.
   *
   * **De-duplicated by id**, because offset paging is not stable: a notification arriving
   * between two requests shifts the window and would otherwise repeat a row. The app has the
   * same window and does not do this.
   *
   * A failure leaves what is on screen alone and lets the button be pressed again — the pages
   * already loaded are still good, so replacing them with an error state would be a downgrade
   * (`notifications_screen.dart:318-337` says exactly that).
   */
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchNotifications(createClient(), { offset: items.length });
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.filter((n) => !seen.has(n.id))];
      });
      setHasMore(page.length >= NOTIFICATIONS_PAGE_SIZE);
    } catch {
      toast.error("Couldn't load older notifications.");
    } finally {
      setLoadingMore(false);
    }
  }

  /** Stamp locally first, then tell the server. Reverted on failure. */
  async function markRead(ids: string[]) {
    const targets = items.filter((n) => ids.includes(n.id) && isUnread(n)).map((n) => n.id);
    if (targets.length === 0) return;
    const now = new Date();
    setItems((prev) =>
      prev.map((n) => (targets.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)),
    );
    const supabase = createClient();
    try {
      await Promise.all(targets.map((id) => markNotificationRead(supabase, id)));
    } catch {
      setItems((prev) =>
        prev.map((n) => (targets.includes(n.id) ? { ...n, readAt: null } : n)),
      );
      toast.error("Couldn't mark that as read.");
    }
  }

  async function markAll() {
    setBusy(true);
    const before = items;
    const now = new Date();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    try {
      await markAllNotificationsRead(createClient());
    } catch {
      setItems(before);
      toast.error("Couldn't mark everything as read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="gap-md mb-base flex items-center justify-between">
        <h1 className="text-display-lg text-ink font-medium">Notifications</h1>
        {unread > 0 ? (
          <Button variant="quiet" busy={busy} onClick={markAll}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {items.length > 0 ? (
        // Counts on the chips, so a tab that would be empty says so before it is tapped.
        <ul className="gap-sm mb-base -mx-1 flex overflow-x-auto px-1 pb-1" aria-label="Filter">
          {NOTIFICATION_FILTERS.map((f) => {
            const count = items.filter((n) => matchesFilter(f.id, n)).length;
            const selected = f.id === filter;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "text-caption px-md py-sm gap-xs flex shrink-0 items-center rounded-full border font-medium",
                    "transition-colors duration-[var(--duration-fast)]",
                    selected
                      ? "border-ink bg-ink text-on-primary"
                      : "border-hairline text-muted hover:border-border-strong",
                  )}
                >
                  {f.label}
                  <span className={selected ? "text-on-primary/70" : "text-muted-soft"}>
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {shown.length === 0 ? (
        // An empty *filter* is a different situation from an empty inbox, and offering
        // "show all" for the latter would be nonsense.
        filter !== "all" ? (
          <EmptyState
            icon={Icons.filterOff}
            title={`Nothing in ${NOTIFICATION_FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}`}
            /*
              **"…on this page" while there is another page.** The chips filter what has been
              loaded, not the table, so with older pages still unread a bare "Nothing here" is a
              claim this component cannot support — and the counts on the chips have the same
              scope. Offering the load from inside the empty state is what makes the two agree.
            */
            message={
              hasMore
                ? "Nothing of this kind on the notifications loaded so far."
                : "Try another tab."
            }
            action={
              hasMore ? (
                <Button variant="outlined" busy={loadingMore} onClick={() => void loadMore()}>
                  Load older
                </Button>
              ) : (
                <Button variant="outlined" onClick={() => setFilter("all")}>
                  Show all
                </Button>
              )
            }
          />
        ) : (
          <EmptyState
            icon={Icons.notification}
            title="No notifications"
            message="Booking updates and reminders will appear here."
          />
        )
      ) : (
        <div className="gap-lg flex flex-col">
          {groupByDay(shown, now).map((group) => {
            const groupUnread = group.items.filter(isUnread).map((n) => n.id);
            return (
              <section key={group.label}>
                <div className="gap-md mb-xs flex items-baseline justify-between">
                  <h2 className="text-caption-sm text-muted font-bold uppercase">
                    {group.label}
                  </h2>
                  {groupUnread.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void markRead(groupUnread)}
                      className="text-caption-sm text-rausch-cta font-medium underline"
                    >
                      Mark {group.label.toLowerCase()} read
                    </button>
                  ) : null}
                </div>
                <ul className="border-hairline-soft divide-hairline-soft divide-y rounded-md border">
                  {group.items.map((n) => (
                    <Row
                      key={n.id}
                      notification={n}
                      now={now}
                      onRead={() => void markRead([n.id])}
                      audience={audience}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {/* The way past the page cap. Absent once a short page has proved there is nothing
              older, rather than sitting there returning nothing. */}
          {hasMore ? (
            <Button
              variant="outlined"
              fullWidth
              busy={loadingMore}
              onClick={() => void loadMore()}
              className="max-w-[20rem] self-center"
            >
              Load older
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const GLYPHS: Record<NotificationIconName, (typeof Icons)[keyof typeof Icons]> = {
  bookingCancelled: Icons.bookingCancelled,
  bookingConfirmed: Icons.bookingConfirmed,
  bookingRescheduled: Icons.bookingRescheduled,
  notification: Icons.notification,
  notificationActive: Icons.notificationActive,
  offer: Icons.offer,
  payment: Icons.payment,
  queue: Icons.queue,
  reward: Icons.reward,
  shopBag: Icons.shopBag,
  star: Icons.star,
  success: Icons.success,
};

const ACCENTS: Record<ReturnType<typeof notificationStyle>["accent"], string> = {
  success: "text-success-text bg-success-soft",
  error: "text-error-text bg-error-soft",
  rausch: "text-rausch-cta bg-rausch/10",
  star: "text-star bg-surface-soft",
  ink: "text-ink bg-surface-soft",
  muted: "text-muted bg-surface-soft",
};

function Row({
  notification: n,
  now,
  onRead,
  audience,
}: {
  notification: AppNotification;
  now: Date;
  onRead: () => void;
  audience: "customer" | "owner";
}) {
  const style = notificationStyle(n.eventType);
  /*
    **The server's own words first.** `notifications.title`/`.body` are filled on every insert
    path by the trigger in `20260807000021`, and the SQL branches on audience — so the row
    already carries the right voice for whoever is reading it, and re-composing it here would
    be a second implementation that drifts the moment the SQL copy changes.

    The local composers stay as the fallback rather than being deleted, for two reasons: a row
    written before those migrations (or by a path that nulls the columns) still needs words,
    and `notificationStyle` — the icon, the accent and the filter bucket — has no server
    equivalent at all, so this module is not going away.
  */
  const composed =
    audience === "owner"
      ? ownerNotificationText(n.eventType, n.payload)
      : notificationText(n.eventType, n.payload);
  const title = n.title ?? composed.title;
  const body = n.body ?? composed.body;
  const Glyph = GLYPHS[style.icon];
  const unread = isUnread(n);

  const inner = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          ACCENTS[style.accent],
        )}
      >
        <Glyph style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="gap-sm flex items-baseline justify-between">
          <span
            className={cn(
              "text-title text-ink truncate",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {title}
          </span>
          <time
            dateTime={n.createdAt.toISOString()}
            className="text-caption-sm text-muted shrink-0 tabular-nums"
          >
            {relativeAge(n.createdAt, now)}
          </time>
        </span>
        {body ? <span className="text-body-sm text-body mt-xxs block">{body}</span> : null}
        <span className="text-caption-sm text-muted-soft mt-xxs block">
          {n.createdAt.toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: THIMPHU_TZ,
          })}
        </span>
      </span>
      {unread ? <span aria-label="Unread" className="bg-rausch size-2 shrink-0 rounded-full" /> : null}
    </>
  );

  const shell = cn(
    "p-base gap-md flex items-start text-left",
    unread ? "bg-surface-soft" : "bg-canvas",
  );

  /**
   * Where a row goes, if anywhere.
   *
   * **The customer's order rows link now.** This used to read *"a customer's order rows stay
   * unlinked until 2f"*, which was right when written — `/orders/[id]` did not exist and a row
   * navigating to a missing route is the dead end `destinations.ts` exists to prevent. 2f
   * shipped that route and the comment outlived its reason, so `order_ready`,
   * `order_declined` and `order_cancelled` have been dead ends for the customer ever since:
   * the one notification that says *"your order is ready for pickup"* had nothing to press.
   *
   * A row with neither id — `loyalty_points_earned`, a review request — still has nowhere
   * useful to go and stays unlinked, which is why this is a chain and not a lookup.
   */
  const href =
    audience === "owner"
      ? n.bookingId
        ? `/business/bookings/${n.bookingId}`
        : n.orderId
          ? `/business/orders/${n.orderId}`
          : null
      : n.bookingId
        ? `/bookings/${n.bookingId}`
        : n.orderId
          ? `/orders/${n.orderId}`
          : null;

  if (href) {
    return (
      <li>
        <Link href={href} onClick={onRead} className={cn(shell, "hover:bg-surface-strong")}>
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      {unread ? (
        <button type="button" onClick={onRead} className={cn(shell, "w-full hover:bg-surface-strong")}>
          {inner}
        </button>
      ) : (
        <div className={shell}>{inner}</div>
      )}
    </li>
  );
}

/**
 * TODAY / YESTERDAY / dated buckets, newest first, in **Thimphu** days.
 *
 * The day boundary is the salon's, not the reader's: a customer in London looking at an
 * 05:00-Thimphu notification should see it filed under the day it happened in Bhutan.
 */
function groupByDay(
  list: AppNotification[],
  now: Date,
): { label: string; items: AppNotification[] }[] {
  const sorted = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const today = thimphuDayKey(now);
  const yesterday = thimphuDayKey(new Date(now.getTime() - 86_400_000));

  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const n of sorted) {
    const key = thimphuDayKey(n.createdAt);
    const label =
      key === today
        ? "TODAY"
        : key === yesterday
          ? "YESTERDAY"
          : n.createdAt
              .toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: THIMPHU_TZ,
              })
              .toUpperCase();
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

/** `YYYY-MM-DD` in Thimphu, for comparing two instants by calendar day. */
function thimphuDayKey(instant: Date): string {
  return instant.toLocaleDateString("en-CA", { timeZone: THIMPHU_TZ });
}
