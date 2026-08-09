"use client";

import { useEffect, useState } from "react";
import { fetchAvailability } from "@/lib/api/booking";
import { createClient } from "@/lib/supabase/client";
import { thimphuDayBoundsUtc } from "@/lib/time";

/**
 * One bookable time, and **who can serve it**.
 *
 * `staffIds` is the whole reason this type exists rather than `Slot`. "Any professional"
 * is a union across stylists, so a slot on that list is a time at which *somebody* is
 * free — and `create_booking` takes exactly one `p_staff_member_id`, so the flow has to
 * carry which ones so it can name a real stylist at confirm time.
 */
export type SlotOption = {
  start: Date;
  end: Date;
  /** Every eligible stylist free at this time. Length 1 unless "Any" is chosen. */
  staffIds: string[];
};

/**
 * Slots for one day, across one or more stylists.
 *
 * ## The fan-out, and why the server cannot do it
 *
 * `compute_availability` takes a single `p_staff_member_id`. There is no RPC that
 * answers "when is *anyone* free", so "Any professional — maximum availability" is
 * necessarily N calls unioned in the browser. That is affordable because N is the number
 * of stylists who perform **every** service in the basket (`eligibleStaff`), which on
 * live data is at most two — the largest roster on the platform is two active stylists,
 * and the Basic cap keeps it there.
 *
 * If that stops being true, this is the thing to move server-side. It is not a candidate
 * for a `Promise.all` over twenty stylists.
 *
 * **A failed leg is not a failed day.** One stylist's call raising should not blank the
 * whole grid, so each is caught and contributes nothing; the union of the rest still
 * renders. The only total failure is every leg failing, which surfaces as `error`.
 *
 * ## Days are Thimphu days
 *
 * The same rule `SlotPicker` follows: the RPC is asked for the UTC bounds of a *Thimphu*
 * calendar day, and the times are rendered in Thimphu. A customer in London looking at a
 * Bhutanese salon must see the hour they will actually turn up at.
 */
export function useAvailability({
  staffIds,
  serviceIds,
  day,
  reloadKey = 0,
}: {
  /** The stylists to ask about. One when a specific person is chosen. */
  staffIds: string[];
  serviceIds: string[];
  day: Date;
  /** Bump to re-fetch — after a failed write, so a taken slot stops being offered. */
  reloadKey?: number;
}): { slots: SlotOption[]; loading: boolean; error: boolean } {
  /**
   * The last answer, tagged with the request it answers.
   *
   * One piece of state rather than three, and **set only inside the promise** — the
   * shape `slot-picker.tsx` already uses. Setting `loading` synchronously at the top of
   * the effect is the obvious alternative and is a cascading render: React runs the
   * effect, the effect sets state, React renders again, all before anything has been
   * fetched. Tagging instead makes "loading" a *derived* fact — the stored answer is for
   * a different request than the one being asked — which needs no extra render at all.
   */
  const [result, setResult] = useState<{
    key: string;
    slots: SlotOption[];
    failed: boolean;
  } | null>(null);

  // Both are arrays rebuilt on every render by the caller, so they are the wrong thing
  // to put in a dependency list — the effect would run forever. The joined strings are
  // the actual identity of the request.
  const staffKey = staffIds.join(",");
  const serviceKey = serviceIds.join(",");
  const dayKey = day.getTime();
  const nothingToAsk = staffKey === "" || serviceKey === "";
  const requestKey = `${staffKey}|${serviceKey}|${dayKey}|${reloadKey}`;

  useEffect(() => {
    if (nothingToAsk) return;

    let live = true;
    const supabase = createClient();
    const { from, to } = thimphuDayBoundsUtc(new Date(dayKey));
    const ids = staffKey.split(",");
    const services = serviceKey.split(",");

    Promise.all(
      ids.map((staffId) =>
        fetchAvailability(supabase, { staffId, serviceIds: services, from, to })
          .then((list) => ({ staffId, list }))
          // See above: one stylist failing costs that stylist's slots, not the day.
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (!live) return;
        const ok = results.filter((r) => r !== null);
        if (ok.length === 0) {
          setResult({ key: requestKey, slots: [], failed: true });
          return;
        }

        // Keyed by instant, so two stylists free at 15:00 are one row offering both.
        const byStart = new Map<number, SlotOption>();
        for (const { staffId, list } of ok) {
          for (const slot of list) {
            const key = slot.start.getTime();
            const existing = byStart.get(key);
            if (existing) {
              if (!existing.staffIds.includes(staffId)) existing.staffIds.push(staffId);
            } else {
              byStart.set(key, {
                start: slot.start,
                end: slot.end,
                staffIds: [staffId],
              });
            }
          }
        }

        setResult({
          key: requestKey,
          slots: [...byStart.values()].sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
          ),
          failed: false,
        });
      })
      .catch(() => {
        // `Promise.all` over already-caught legs cannot reject, but a throw while
        // building the union would otherwise leave the hook loading for ever.
        if (live) setResult({ key: requestKey, slots: [], failed: true });
      });

    return () => {
      live = false;
    };
    // `staffKey`, `serviceKey`, `dayKey` and `reloadKey` are all folded into `requestKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, nothingToAsk]);

  // Nothing asked is answered, not pending: an empty basket has no slots and is not
  // waiting for any. Anything else is loading until the stored answer names this request.
  const current = nothingToAsk
    ? { slots: [] as SlotOption[], failed: false }
    : result?.key === requestKey
      ? result
      : null;

  return {
    slots: current?.slots ?? [],
    loading: current == null,
    error: current?.failed ?? false,
  };
}
