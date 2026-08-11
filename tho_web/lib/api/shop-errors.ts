import { asSentence, errorCode } from "./booking-errors";

/**
 * Turning a shop or loyalty rejection into a sentence.
 *
 * A fourth error module, for the reason `queue-errors.ts` and `owner-errors.ts` already record:
 * **the same SQLSTATE means different things in different RPCs.** `P0001` is *"this salon is not
 * taking product orders"* from `place_order` and one of three different sentences from
 * `request_redemption`, so a table keyed on code alone would have to pick one and be wrong twice.
 * These are keyed by *(action, code)*.
 *
 * **`P0002` is this module's own case, and it is not really an error.** `place_order` raises it when
 * anything in the payload is no longer buyable — sold out, archived, or belonging to another salon.
 * The right response is not a message but a **re-price**: reload the salon's catalogue, drop what is
 * gone, and let the customer look at what is left. `isUnavailable` exists so the caller can branch
 * on that before it reaches for words.
 */

export const SHOP_ERROR = {
  /** No session at all. */
  unauthenticated: "28000",
  /** A guest tried to commit — `private.is_real_user()` refused. Both write RPCs raise it. */
  guestRefused: "P0010",
  /** Something in the cart is no longer buyable. `place_order` only. */
  unavailable: "P0002",
  /** The catch-all raise: a plan gate, a missing reward, or not enough points. */
  raised: "P0001",
  /** Acting on somebody else's order or redemption. Should be unreachable. */
  notYours: "42501",
} as const;

export type ShopAction =
  | "placeOrder"
  | "cancelOrder"
  | "redeem"
  | "cancelRedemption"
  | "loadProducts";

const FALLBACK: Record<ShopAction, string> = {
  placeOrder: "Couldn't place your order. Please try again.",
  cancelOrder: "Couldn't cancel that order.",
  redeem: "Couldn't redeem that reward.",
  cancelRedemption: "Couldn't cancel that redemption.",
  loadProducts: "Couldn't load products.",
};

/**
 * True when the server refused because something in the cart has gone.
 *
 * The caller should re-price rather than show a message — see the module note.
 */
export function isUnavailable(error: unknown): boolean {
  return errorCode(error) === SHOP_ERROR.unavailable;
}

export function shopErrorMessage(action: ShopAction, error: unknown): string {
  const code = errorCode(error);
  const fallback = FALLBACK[action];

  if (code === SHOP_ERROR.unauthenticated) {
    return "Your session expired. Sign in and try again.";
  }
  if (code === SHOP_ERROR.guestRefused) {
    // The wall should have come first, so reaching this means it was bypassed. Say what to do
    // rather than pretending it was a server fault — the rule `bookingErrorMessage` set.
    return action === "redeem"
      ? "Create an account to redeem rewards."
      : "Create an account to place an order.";
  }
  if (code === SHOP_ERROR.unavailable) {
    return "Something in your cart just sold out — please review it.";
  }
  if (code === SHOP_ERROR.notYours) {
    return "That isn't yours to change.";
  }

  if (code === SHOP_ERROR.raised) {
    switch (action) {
      case "placeOrder":
        // 'this salon is not taking product orders' — the plan gate, and the only useful reply.
        return messageOf(error, fallback);
      case "cancelOrder":
        // 'you can only cancel an order while it is new' — someone at the salon marked it ready
        // between the render and the press.
        return "That order has already been started — ask the salon to cancel it.";
      case "redeem":
        // 'loyalty program not available' / 'reward not available' / 'insufficient points'. Each
        // names exactly the thing that changed, and two of the three are races worth reading.
        return messageOf(error, fallback);
      case "cancelRedemption":
        // 'redemption is not pending' — the salon honoured it while the screen was open, which is
        // good news wearing an error's clothes.
        return "That reward was already used.";
      default:
        return messageOf(error, fallback);
    }
  }

  return fallback;
}

function messageOf(error: unknown, fallback: string): string {
  const message =
    typeof error === "object" && error !== null
      ? (error as { message?: string }).message
      : undefined;
  return message ? asSentence(message) : fallback;
}
