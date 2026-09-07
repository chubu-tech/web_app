"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { Cart } from "@/lib/cart";
import type { Product } from "@/lib/types/salon";
import { useCart } from "@/lib/use-cart";

/**
 * Adding to the order, and the one question that has to be asked before it can happen.
 *
 * **The one-salon rule is the schema's, not a preference.** `place_order` takes a single
 * `p_business` and validates every line against it, so a cart spanning two salons could not
 * be placed at all. `lib/cart.ts` already reports the clash instead of throwing; what was
 * missing was somewhere sensible to put the answer.
 *
 * Both shop surfaces had their own copy of that answer, and both got it wrong the same way:
 * a red `toast.error` reading *"Your cart has items from another salon"* with a "Start new"
 * action. Three things are wrong with an error there. It **blames the customer** for a rule
 * they had no way to know. It is a **transient** control — the one affordance out of the
 * situation disappears on a timer. And it states the problem where the customer needed the
 * choice. Upstream asks instead, and keeps the first cart until they answer.
 *
 * So this hook is that module: one place that knows the rule, the question, and the two
 * guards below, used by the browse and by a salon's own shelf.
 *
 * ## The two guards
 *
 * Both are cases where the quantity control could get around the question.
 *
 * 1. **A raise from zero goes through the add path.** `setQty` on a product that is not in
 *    the cart matches no line, so it silently returns the cart unchanged — the customer
 *    presses `+`, nothing happens, and no question is asked. Routing it through `add` is
 *    what makes the refusal reachable.
 * 2. **No quantity is written for a product the cart declined.** The pending product is not
 *    in the cart, so anything the caller does with its quantity while the sheet is open must
 *    be a no-op rather than a line written against the wrong salon.
 */
export function useOrderCart() {
  const { cart, add, setQty, replace } = useCart();
  const [pending, setPending] = useState<{ product: Product; replacement: Cart } | null>(null);

  const qtyOf = useCallback(
    (productId: string) => cart.lines.find((l) => l.productId === productId)?.qty ?? 0,
    [cart.lines],
  );

  const addProduct = useCallback(
    (product: Product) => {
      const result = add(product);
      // The cart is left exactly as it was; nothing is written until the answer.
      if (!result.ok) setPending({ product, replacement: result.replacement });
    },
    [add],
  );

  /** Guard 1. Takes the product rather than an id precisely so it can fall back to `add`. */
  const setProductQty = useCallback(
    (product: Product, qty: number) => {
      if (qty > 0 && qtyOf(product.id) === 0) {
        addProduct(product);
        return;
      }
      setQty(product.id, qty);
    },
    [addProduct, qtyOf, setQty],
  );

  const dialog = (
    <StartNewOrder
      product={pending?.product ?? null}
      onKeep={() => setPending(null)}
      onStart={() => {
        if (pending) replace(pending.replacement);
        setPending(null);
      }}
    />
  );

  return { cart, qtyOf, addProduct, setProductQty, dialog };
}

/**
 * **A question, not an error.** The title asks; the body explains the rule that made the
 * question necessary; the buttons are both ordinary outcomes. "Keep it" is first and is the
 * quiet variant, because doing nothing to an order already half-built is the safer answer
 * and the one a mis-tap should land on.
 */
function StartNewOrder({
  product,
  onKeep,
  onStart,
}: {
  product: Product | null;
  onKeep: () => void;
  onStart: () => void;
}) {
  // The salon's own name, which `product_cards` now carries on every read — the shelf used
  // to have to pass it down as a prop because the bare table select never joined it.
  const salon = product?.businessName ?? "this salon";

  return (
    <Sheet
      open={product != null}
      onClose={onKeep}
      title="Start a new order?"
      footer={
        <div className="gap-sm flex">
          <Button variant="outlined" fullWidth onClick={onKeep}>
            Keep it
          </Button>
          <Button fullWidth onClick={onStart}>
            Start a new order
          </Button>
        </div>
      }
    >
      <p className="text-body-md text-body">
        Your order is with another salon, and each order goes to one salon. Start a new order
        at {salon}?
      </p>
    </Sheet>
  );
}
