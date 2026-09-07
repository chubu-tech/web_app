/**
 * Normalising what a `returns <table>` RPC hands back into exactly one row.
 *
 * A port of `_oneRow` in `../tho/app/lib/data/api.dart:2898-2905`, which replaced the same
 * ternary copy-pasted at **eleven** call sites. This repo had it twice, and the two copies
 * did not agree — which is the reason to have one.
 *
 * PostgREST returns a bare object for a composite-returning function in some shapes and
 * wraps it in an array in others, so the normalisation is unavoidable. What is avoidable is
 * the second half: **a plpgsql function declared `returns public.orders` is free to return
 * NULL, and an empty array is possible too.** The copy in `owner.ts` answered `{}` for both,
 * which does not fail — it hands a mapper an object with every field undefined, and the
 * caller gets a domain object full of holes, or an opaque `TypeError` thrown from inside a
 * mapper that names nothing about where it came from.
 *
 * So this throws, and says what it actually got.
 */
export function oneRow(data: unknown, what = "RPC"): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (row == null || typeof row !== "object" || Array.isArray(row)) {
    return fail(what, data);
  }
  return row as Record<string, unknown>;
}

function fail(what: string, data: unknown): never {
  const got =
    data === null
      ? "null"
      : data === undefined
        ? "undefined"
        : Array.isArray(data)
          ? `an array of ${data.length}`
          : typeof data;
  throw new Error(`${what} returned no row (got ${got})`);
}
