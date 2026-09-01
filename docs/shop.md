## The customer shop — products, cart, orders, loyalty

### The cart is persistent, so it must re-price

The app's cart lives for minutes in memory and reconciles with the catalogue only *after*
`place_order` refuses. This one is in `localStorage`, so it can be days old — and `place_order`
computes `total_nu` from `products.price_nu` **server-side**, so a stale subtotal would promise a
number the order does not charge. `/cart` therefore reads the salon's live shelf and runs
`repriceCart` before it paints, then says what moved: *"Matte Hair Wax is sold out — removed from
your cart"*, *"Argan Hair Oil is now Nu 500, was Nu 450"*. Silently changing a total would be worse
than either. Proved on live data at all three timings: a sell-out and a price change caught on open,
and a sell-out that lands *after* the re-price caught by `P0002` on the press — which re-prices
rather than showing a bare error.

`repriceCart` returning `{cart, dropped, repriced}` rather than just a cart is what makes those
sentences possible. A function that quietly fixed the cart would be the same bug with better
manners.

### The idempotency token belongs to the cart, not the button

`place_order` de-duplicates on `(business, customer, client_token)`, so **one token per cart, held
across every retry**, is what makes a double-press or a timeout-then-retry safe. It lives in
`localStorage` beside the cart, not in a ref, because a reload of `/cart` must not mint a new one —
a ref would, and the customer would pay twice for one basket. `clear()` retires it, which is why it
is only called after a confirmed success. Measured: two presses on a held token → **one** row;
re-adding after success (which mints the next token) → a genuine second order.

Same rule, same reason, in `LoyaltyCard`: one token per reward for the life of the mount. **This is
the call the Flutter app gets wrong** — `Api.requestRedemption` passes `clientToken ?? _uuid.v4()`
and its only caller passes nothing, so every attempt mints a fresh token and a retry after an
ambiguous failure creates a *second* pending redemption holding the points twice. Replaying the
held token against the live RPC returns the same row and adds none.

### `fetchMyOrders` filters — the third instance of the OR-policy leak

`orders_select_owner` admits `is_business_owner(business_id)`, so an unfiltered `select orders` hands
an owner their salon's orders under **"My orders"**. Measured on the live database as **3 rows vs
0** for the same account, and that is exactly what `Api.myOrders()` does today. `/orders/[id]`
refuses a member the same way `/messages/[id]` does. Check the policy before trusting a `fetchMy…`
name; this is the third time.

### Three server-side gates, none of them the client's business

All measured through the MCP, because no UI can reach the first two:

- **The plan.** `products_select_public` requires `growth`/`pro`, so a Basic salon's products are
  invisible and `fetchProducts` needs no plan filter. `place_order` against one raises *"this salon
  is not taking product orders"*.
- **Stock.** `Beard Grooming Kit` is `in_stock = false`, so it is absent from the browse and the
  Shop tab; ordering it by id raises `P0002` *"a product is no longer available"*.
- **A real account.** `place_order` and `request_redemption` both require
  `private.is_real_user()` — which reads `is_anonymous` straight off the JWT — and raise `P0010`
  *"create an account to order"* / *"…to redeem rewards"*. A guest still browses and still fills the
  cart, and because the cart is local it is **still there** after the sign-up round trip.

**The wall is at Place order and Redeem, never at Add to cart.** Asking for an account before
showing why one is worth having is the one thing this app deliberately protects against.

### `in_stock` is a boolean, so there is no "2 left"

And there is no payment: cash on collection is the whole model, `payments` is Pro-gated with 0 rows,
and nothing in the shop takes a card — including delivery, where the cash changes hands at the door.

**The rest of this paragraph described a shop the app no longer has, so read it as history.** Every
sentence below was true on 2026-08-11 and was rewritten upstream by the four shop slices; none of
that has been ported, and `PARITY.md` §5.1 is the list.

- *"Neither `reviews` nor `favourites` has a product column, so products have neither."* Both exist
  now, in their own tables: `product_reviews` (verified purchase only, writable **solely** through
  `submit_product_review`) and `product_saves` (the wishlist).
- *"`Api.products` loads everything and there are 4 live, so there is no pagination."*
  `Api.products` was **deleted** upstream (`ec8b8ce`) in favour of paginated `browseProducts` over
  the `product_cards` view. `fetchProducts` here is now the last unbounded catalogue read on any
  platform. Still harmless at 4 products; it is the first thing to replace when the shop is ported,
  not the last.
- Products also gained a taxonomy (`product_categories`, `product_brands`), galleries
  (`product_photos`), markdowns (`compare_at_nu`), and six description columns. This repo reads
  none of them.

### Orders and rewards are one flat list each

No segments, matching the app: a customer's own history is small where the owner's inbox needed
New / Ready / Done. And `my_loyalty_summary` lists a salon only when the balance is **non-zero** or
a redemption is pending, so a spent-out customer sees the empty state rather than a row of zeroes —
which means *"no points yet"* also means *"no points left"*, and `/rewards` says so.

The redemption counter on the owner's side is `fetchPendingRedemptions` — a **queue, not a history**.
It lists what is waiting to be honoured and nothing else, which is right for somebody working
through it at the till, and it means a confirmed or cancelled claim vanishes rather than being
filed. Do not "fix" it into a log.

**The Settings hub does not count waiting claims.** `loyaltyLine` states the programme and its
reward count where the orders row states *"1 new order"* — measured, and left alone, because
`private.enqueue_order_notification` files a `loyalty_redemption_requested` to the **owner** for
every claim, and the bell is the path that actually reaches them.

### One owner payload does carry something

`order_placed` and `order_cancelled` arrive as `{}`, as the inbox section says. But
`loyalty_redemption_requested` carries **`reward` and `code`** — only observable once 2f made it
possible to create a redemption at all, since `loyalty_redemptions` had 0 rows platform-wide. So the
owner's bell quotes the code the customer is holding up rather than pointing at the page that would
show it. Still the same rule: say what the row can support, and nothing else.
