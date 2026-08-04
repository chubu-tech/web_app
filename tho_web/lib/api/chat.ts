import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Message } from "../types/chat";
import { toConversation, toMessage } from "./mappers";

/**
 * Customer↔salon chat, ported from the chat section of
 * `tho/app/lib/data/api.dart:861`.
 *
 * **`conversations` and `messages` are the two tables this app writes directly**, and that
 * is deliberate rather than an oversight: the Flutter app writes them the same way, and
 * their RLS policies are the real authority — `messages_insert` requires the sender to be
 * the caller, the caller to be a real user, and the caller to belong to the conversation.
 * There is no RPC to route through. Everything else still goes through one.
 *
 * **A guest can read but not write.** Both insert policies require
 * `private.is_real_user()`, so the guest wall belongs in front of starting a thread and
 * in front of sending — not after the failure.
 */

/** The embeds the thread list needs: the salon's name and cover for the row. */
const CONVERSATION_SELECT = "*, businesses(name, cover_url)";

/**
 * The caller's own threads, newest activity first.
 *
 * **Filtered on `customer_profile_id`, unlike the app.** `conversations_select`
 * OR-matches *customer or business member*, and `myConversations()` in the app leans on
 * RLS alone — so a user who also belongs to a salon is handed their salon's customer
 * threads in their own inbox. This app has no owner surface, so those threads would be
 * unanswerable *and* would expose other customers' messages in a personal inbox. Same
 * correction `fetchMyActiveEntries` needed for `queue_entries`.
 *
 * `nullsFirst: false` keeps a thread that has never been written in at the bottom rather
 * than the top — `last_message_at` is null for exactly one live row.
 */
export async function fetchMyConversations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("customer_profile_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toConversation);
}

/**
 * The caller's thread with a salon, creating it if there isn't one.
 *
 * Get-or-create rather than insert-and-handle-conflict, matching the app: there is no
 * unique constraint on (business, customer), so a blind insert would quietly make a
 * second thread and split the conversation in half.
 *
 * The customer's name is snapshotted onto the row for the salon's list, as the app does.
 */
export async function startConversation(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<Conversation> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("business_id", businessId)
    .eq("customer_profile_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return toConversation(existing as Record<string, unknown>);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_profile_id: userId,
      customer_name: (profile?.full_name as string | null) ?? null,
    })
    .select(CONVERSATION_SELECT)
    .single();
  if (error) throw error;
  return toConversation(data as Record<string, unknown>);
}

/** One thread by id, for the thread page's first render. RLS scopes it to the caller's own. */
export async function fetchConversationById(
  supabase: SupabaseClient,
  id: string,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toConversation(data as Record<string, unknown>) : null;
}

/** Oldest first — a transcript reads downwards. */
export async function fetchMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toMessage);
}

/**
 * Send one message.
 *
 * A direct insert, as above. `private.touch_conversation` fires on the row and moves
 * `last_message` / `last_message_at`, which is why the thread list needs no join and why
 * nothing here updates the conversation by hand.
 */
export async function sendMessage(
  supabase: SupabaseClient,
  { conversationId, senderId, body }: { conversationId: string; senderId: string; body: string },
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_profile_id: senderId,
      body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toMessage(data as Record<string, unknown>);
}

/**
 * Stamps the caller's **own** side of the thread as read.
 *
 * Which side is decided server-side from `auth.uid()`, so a customer cannot mark the
 * salon's side read and make a thread disappear from their list.
 */
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation: conversationId,
  });
  if (error) throw error;
}
