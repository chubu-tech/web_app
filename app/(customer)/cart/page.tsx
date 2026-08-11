import type { Metadata } from "next";
import { CartView } from "@/components/customer/cart-view";
import { getAccount } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

/**
 * The cart.
 *
 * **A route rather than the app's bottom sheet** — the third time this app has made that call, after
 * 3b's setup accordions and 3c's owner drawer. Here it buys something the others didn't: the cart
 * lives in `localStorage`, so `/cart` reloads into exactly the same basket, and a customer can close
 * the tab and come back to it. A sheet has no URL to come back to.
 *
 * The page itself knows nothing about the cart — `localStorage` is a browser fact, so the whole thing
 * is a client component. What the server contributes is the one thing the browser cannot decide:
 * **whether this session is a real account**, since `place_order` refuses a guest with `P0010` and
 * the wall has to know before the press, not after.
 */
export default async function CartPage() {
  const account = await getAccount();

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">Your cart</h1>
      {/*
        Both flags, because they are different questions. `anonymous` has no session at all and
        `guest` has one that `private.is_real_user()` refuses — either way the wall is needed, but
        only a guest can be *upgraded* in place, keeping the same user id.
      */}
      <CartView
        signedIn={account.state === "registered"}
        isGuest={account.state === "guest"}
      />
    </div>
  );
}
