"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addToCart,
  EMPTY_CART,
  parseCart,
  setQty as setLineQty,
  type AddResult,
  type Cart,
} from "./cart";
import type { Product } from "./types/salon";

/**
 * The cart, in `localStorage`, read through `useSyncExternalStore`.
 *
 * The Flutter cart is an in-memory `ChangeNotifier` that dies with the app. A browser tab closes far
 * more casually, so this persists — which is a genuine improvement and also the source of the one
 * problem the app never had: **a stored cart can outlive a price change or a sell-out.**
 * `repriceCart` is the answer and `/cart` calls it; nothing here needs to know.
 *
 * ## Why `useSyncExternalStore` and not an effect
 *
 * The first version read `localStorage` in a `useEffect` and called `setCart` — the canonical
 * hydration dance, and `react-hooks/set-state-in-effect` refuses it, correctly: it cascades a render
 * for a value that was knowable without one. `localStorage` **is** an external store with a
 * subscription (`storage`) and a snapshot (`getItem`), which is precisely what this hook is for. It
 * also gets the SSR case right by construction: `getServerSnapshot` returns an empty cart, so the
 * server's HTML and the first client render agree, and React swaps in the real value at hydration
 * with no mismatch warning and no flash.
 *
 * `hydrated` falls out of the same mechanism — `() => true` on the client, `() => false` on the
 * server — so a caller can still refuse to render an empty cart before it knows, without a flag it
 * has to set itself.
 *
 * ## Two tabs
 *
 * `storage` fires in *other* tabs only, so a same-tab write needs its own signal: every write
 * dispatches `tho:cart`, and `subscribe` listens for both. Two tabs on the same salon page therefore
 * agree about the cart without either polling — free on the web, and impossible in the app.
 *
 * ## The idempotency token
 *
 * `place_order` de-duplicates on `(business, customer, client_token)`, so **one token per cart**, held
 * across every retry, is what makes a double-press or a timeout-then-retry safe. It lives beside the
 * cart rather than in a ref because a reload of `/cart` must not mint a new one — a ref would, and
 * the customer would place a second order for the same basket. `clear()` retires it, which is why it
 * is only called after a confirmed success.
 */

const CART_KEY = "tho.cart.v1";
const TOKEN_KEY = "tho.cart.token.v1";
const EVENT = "tho:cart";

type Snapshot = { cart: Cart; token: string };

const SERVER_SNAPSHOT: Snapshot = { cart: EMPTY_CART, token: "" };

/**
 * `getSnapshot` must return a **referentially stable** value or React re-renders forever, so the
 * parsed cart is cached against the raw string it came from and only re-parsed when that changes.
 */
let cachedRaw: string | null = null;
let cachedToken: string | null = null;
let cachedSnapshot: Snapshot = SERVER_SNAPSHOT;

function getSnapshot(): Snapshot {
  const raw = readLocal(CART_KEY);
  const token = readLocal(TOKEN_KEY) ?? "";
  if (raw === cachedRaw && token === cachedToken) return cachedSnapshot;
  cachedRaw = raw;
  cachedToken = token;
  cachedSnapshot = { cart: parseCart(raw), token };
  return cachedSnapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_KEY || event.key === TOKEN_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

export type UseCart = {
  cart: Cart;
  /** False during SSR and the hydrating render — see the note above. */
  hydrated: boolean;
  /** The token to pass to `place_order`, stable for the life of this cart. */
  clientToken: string;
  add: (product: Product) => AddResult;
  setQty: (productId: string, qty: number) => void;
  replace: (cart: Cart) => void;
  clear: () => void;
};

export function useCart(): UseCart {
  const { cart, token } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const write = useCallback((next: Cart) => {
    writeLocal(CART_KEY, JSON.stringify(next));
    // Minted lazily so a visitor who never adds anything never gets a token at all.
    if (!readLocal(TOKEN_KEY)) writeLocal(TOKEN_KEY, crypto.randomUUID());
    notify();
  }, []);

  const add = useCallback(
    (product: Product): AddResult => {
      const result = addToCart(cart, product);
      // A refusal writes nothing: the caller decides whether to start over with `replace`.
      if (result.ok) write(result.cart);
      return result;
    },
    [cart, write],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => write(setLineQty(cart, productId, qty)),
    [cart, write],
  );

  const replace = useCallback((next: Cart) => write(next), [write]);

  const clear = useCallback(() => {
    writeLocal(CART_KEY, JSON.stringify(EMPTY_CART));
    // Retire the token with the cart, so the next order is a new order rather than a duplicate of
    // the one just placed.
    writeLocal(TOKEN_KEY, crypto.randomUUID());
    notify();
  }, []);

  return { cart, hydrated, clientToken: token, add, setQty, replace, clear };
}

function notify(): void {
  window.dispatchEvent(new Event(EVENT));
}

/**
 * `localStorage` throws in Safari private mode and when a quota is exceeded, and a cart is never
 * worth taking a page down for — so both accessors swallow. A customer in private mode falls back to
 * the app's own in-memory-per-page behaviour, which is the right degradation rather than a crash.
 */
function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode or quota — this page keeps working, the cart just won't persist */
  }
}
