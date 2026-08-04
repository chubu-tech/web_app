"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchMessages, markConversationRead, sendMessage } from "@/lib/api/chat";
import { isMine } from "@/lib/chat-logic";
import { createClient } from "@/lib/supabase/client";
import { THIMPHU_TZ } from "@/lib/time";
import { QUICK_REPLIES, type Message } from "@/lib/types/chat";
import { cn } from "@/lib/utils";
import { usePollTick } from "./use-poll";

/**
 * One thread, ported from `tho/app/lib/chat/chat_thread_screen.dart`.
 *
 * Polls every **3s** — the app's cadence — pausing on a hidden tab via `usePollTick`. No
 * Realtime: `messages` has no publication configured, and adding one is a change in
 * `../tho`.
 *
 * **The thread is marked read once, on open.** Not on every poll: `mark_conversation_read`
 * stamps `now()`, so polling it would rewrite the timestamp every 3 seconds and the
 * salon's side would never see a stable "last read".
 */
export function ChatThread({
  conversationId,
  viewerId,
  initial,
}: {
  conversationId: string;
  viewerId: string;
  initial: Message[];
}) {
  const [messages, setMessages] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const tick = usePollTick(3_000);
  const bottom = useRef<HTMLDivElement>(null);
  /** The count at the last scroll, so only *growth* scrolls — not every re-render. */
  const lastCount = useRef(initial.length);

  useEffect(() => {
    let live = true;
    fetchMessages(createClient(), conversationId)
      .then((next) => {
        if (!live) return;
        setMessages(next);
        setFailed(false);
      })
      .catch(() => {
        // Keep the transcript on screen; a poll failure is not an empty conversation.
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [conversationId, tick]);

  useEffect(() => {
    if (messages.length === lastCount.current) return;
    lastCount.current = messages.length;
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    // Best-effort and deliberately not in the poll: see the note above.
    void markConversationRead(createClient(), conversationId).catch(() => {});
  }, [conversationId]);

  async function send(body: string) {
    const text = body.trim();
    if (text.length === 0 || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(createClient(), {
        conversationId,
        senderId: viewerId,
        body: text,
      });
      setDraft("");
      // Append rather than wait for the next poll — up to 3s of nothing happening after
      // pressing send reads as a failure.
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      /**
       * **Mark read again, after sending.** `isUnreadFor` is a timestamp comparison and
       * the conversation row carries no sender for `last_message`, so without this the
       * message you just wrote makes your *own* thread unread to you: bold row, badge of
       * 1, until you navigate away and back. The Dart original claims this carve-out in a
       * comment and has the same gap; it was visible on live data.
       *
       * Safe to fire per send: the sender has by definition seen everything up to their
       * own message, and it only ever moves this reader's own side forward.
       */
      void markConversationRead(createClient(), conversationId).catch(() => {});
    } catch {
      toast.error("Couldn't send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="gap-sm flex flex-1 flex-col overflow-y-auto pb-base">
        {messages.length === 0 ? (
          failed ? (
            <p className="text-body-sm text-muted p-base text-center">
              Couldn&apos;t load this conversation. It keeps trying.
            </p>
          ) : (
            <p className="text-body-sm text-muted p-base text-center">
              No messages yet — say hello.
            </p>
          )
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} mine={isMine(m, viewerId)} />)
        )}
        <div ref={bottom} />
      </div>

      {/* Starting points, only while the box is empty — as the app does. */}
      {draft.trim().length === 0 ? (
        <ul className="gap-sm -mx-1 mb-sm flex overflow-x-auto px-1 pb-1">
          {QUICK_REPLIES.map((text) => (
            <li key={text}>
              <button
                type="button"
                disabled={sending}
                // **Fills the box rather than sending.** A tap that fires a message with
                // no chance to edit is too easy to do by accident, and these are
                // starting points, not final answers (`chat_thread_screen.dart:145`).
                onClick={() => setDraft(text)}
                className="border-hairline bg-surface-soft text-body-sm text-ink px-md py-sm hover:border-border-strong shrink-0 rounded-full border disabled:opacity-50"
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="border-hairline bg-canvas gap-sm sticky bottom-0 flex items-end border-t pt-sm"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — what a chat box does. The app
              // has a single-line field and no equivalent choice to make.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={1}
            placeholder="Write a message…"
            className="border-hairline px-md py-sm text-body-md text-ink placeholder:text-muted-soft focus:border-ink max-h-32 min-h-12 w-full resize-y rounded-sm border focus:border-2 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          aria-label="Send"
          className="bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed disabled:bg-rausch-disabled flex size-12 shrink-0 items-center justify-center rounded-full"
        >
          <Icons.send style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "px-base py-sm max-w-[80%] rounded-md",
          mine ? "bg-rausch-cta text-on-primary" : "bg-surface-soft text-ink",
        )}
      >
        <p className="text-body-md whitespace-pre-wrap break-words">{message.body}</p>
        <time
          dateTime={message.createdAt.toISOString()}
          className={cn(
            "text-caption-sm mt-xxs block tabular-nums",
            mine ? "text-on-primary/75" : "text-muted",
          )}
        >
          {message.createdAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: THIMPHU_TZ,
          })}
        </time>
      </div>
    </div>
  );
}
