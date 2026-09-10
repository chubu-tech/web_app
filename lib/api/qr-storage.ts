import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Keeping each salon's QR image in the database's file store.
 *
 * ## What "in the database" means here, and what it cannot mean
 *
 * There is no column to put it in. AGENTS.md is explicit — **this repo owns no data and
 * never writes SQL**; a `businesses.qr_image_url` would be a migration, and migrations belong
 * in `../tho/supabase/migrations`. So the image goes where every other image in this product
 * goes: the **`media` bucket**, which is part of the same Supabase project and is public.
 *
 * That turns out to be better than a column would have been, because the path is derivable.
 * `qrObjectPath` is a pure function of the owner's uid and the salon's id, so the public URL
 * can be computed without reading anything — there is no row to keep in sync, and nothing to
 * migrate.
 *
 * ## A stable path, which is a deliberate exception
 *
 * AGENTS.md says *"a fresh path per upload, never `upsert: true`"*, and the reasoning behind
 * it is sound: a new path is its own cache key, and two writes can never race. This file
 * keeps the second half of that rule — **it never upserts** — and deliberately breaks the
 * first.
 *
 * The reason is what the feature is: one permanent code per salon, for the life of the salon.
 * A timestamped filename would mint a new URL every time somebody pressed Save, which is
 * exactly the "link that changes" the whole thing exists to avoid.
 *
 * The bytes are a pure function of the salon's id and the fixed `DEEP_LINK_ORIGIN`, so a
 * year-long cache on that path is literally correct rather than merely convenient. **What is
 * not safe is assuming the file already there is current** — that assumption cost this feature
 * once already, when the origin moved and every saved PNG was stranded on the old URL with no
 * writer willing to replace it. `saveQrImage` therefore removes and rewrites on a duplicate,
 * and its note has the detail.
 */

/** The bucket every image in this product lives in. Public-read, `<uid>/…` on write. */
const BUCKET = "media";

/**
 * Where one salon's code lives, forever.
 *
 * **The owner's uid is the first segment because `media_auth_insert` requires it** —
 * `(storage.foldername(name))[1] = auth.uid()`. So a salon's QR sits under whoever owned it
 * when it was saved, the same consequence `uploadOwnerImage` documents for cover photos. The
 * bucket is public, so customers can read it regardless of whose folder it is in.
 */
export function qrObjectPath(userId: string, businessId: string): string {
  return `${userId}/qr-${businessId}.png`;
}

/** The public URL for a saved code. Pure — no read, because the path is derivable. */
export function qrPublicUrl(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(qrObjectPath(userId, businessId));
  return publicUrl;
}

/**
 * Which salons already have a saved code.
 *
 * **One `list` for the whole page**, not one existence check per salon — the owner has ten,
 * and ten round trips to answer "is there a file" would cost more than the page.
 *
 * Readable because `20260804000003_media_own_object_select` restored a SELECT policy scoped
 * to the caller's own folder. Before that migration this would have returned `[]` for
 * everybody, silently, which is the failure mode that made every `remove()` in this product a
 * no-op for four migrations.
 *
 * Returns business ids, so the caller never has to parse a path.
 */
export async function fetchSavedQrBusinessIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
  // A failed listing means "we do not know", and the honest render of that is an unsaved
  // button — pressing it is idempotent, so the cost of being wrong is one 409.
  if (error || !data) return new Set();

  const ids = new Set<string>();
  for (const file of data) {
    const match = /^qr-(.+)\.png$/.exec(file.name);
    if (match) ids.add(match[1]!);
  }
  return ids;
}

/**
 * Save one salon's code, and return its permanent public URL.
 *
 * **A repeat save replaces the file rather than skipping it**, and that is a correction worth
 * explaining. The first version treated the server's `409 Duplicate` as success and stopped
 * there, reasoning that the bytes at a stable path can never legitimately differ. That was
 * true only while the encoded URL was fixed — and it was not: the origin moved from the
 * request's host to the canonical `bhutansalons.com`, which changed every code in the
 * product. Every already-saved PNG became permanently stale, with no way to correct it,
 * because the only writer refused to overwrite.
 *
 * So a duplicate now triggers a delete and a second upload. The cost is one extra round trip
 * on a manual button press; the gain is that "save again" does what its label says and that a
 * stored image can never be stranded on old content.
 *
 * **Still never `upsert: true`.** That is the half of AGENTS.md's rule that matters here: an
 * upsert becomes `insert … on conflict do update`, which Postgres permits only when the
 * conflicting row is *selectable*, and that is the trap that made every owner photo upload in
 * the Flutter app fail silently for four migrations. An explicit remove-then-write does the
 * same job through two operations that each report their own failure.
 *
 * The duplicate check is matched narrowly and **everything else still throws**: Supabase
 * reports "this object exists" and "RLS refused you" as failures alike, and this repo's own QA
 * notes record being fooled by exactly that shape. A real permission failure must not be
 * swallowed into a green "Saved".
 */
export async function saveQrImage(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  png: Blob,
): Promise<string> {
  const path = qrObjectPath(userId, businessId);
  const url = qrPublicUrl(supabase, userId, businessId);

  const first = await put(supabase, path, png);
  if (!first) return url;
  if (!isDuplicate(first)) throw first;

  // Already there, and possibly stale. Clear it and write the current bytes.
  await supabase.storage.from(BUCKET).remove([path]);

  const second = await put(supabase, path, png);
  if (!second) return url;
  /*
    Still a duplicate means the remove was a no-op — which is what `remove()` does when
    nothing is selectable, returning 200 with an empty list rather than an error. The file
    on the server is then whatever was already there. Nothing further can be done from a
    client, and the object *is* a valid code for this salon, so this reports success rather
    than an error the owner cannot act on.
  */
  if (isDuplicate(second)) return url;
  throw second;
}

/** One upload attempt. Returns the error rather than throwing, so the caller can branch. */
async function put(
  supabase: SupabaseClient,
  path: string,
  png: Blob,
): Promise<unknown | null> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: false,
    // The bytes are a pure function of the salon id and the fixed origin, so this is one of
    // the rare files for which a year-long cache is literally correct.
    cacheControl: "31536000",
  });
  return error ?? null;
}

/**
 * Is this "the file is already there" rather than "you may not write here"?
 *
 * Matched on the status code first, since that is the stable signal; the message is checked
 * only as a fallback for clients that do not surface one. Deliberately narrow — anything this
 * does not recognise is re-thrown.
 */
function isDuplicate(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string };
  if (e.statusCode === "409" || e.statusCode === 409 || e.status === 409) return true;
  const message = (e.message ?? "").toLowerCase();
  return message.includes("already exists") || message.includes("duplicate");
}
