## The owner back office — insights, clients, orders, offers, loyalty, money

### Charts, with no charting library

Six visualisations and 3c adds no dependency. Each is built from the primitive that suits it:
`trend-chart.tsx` is an inline SVG path (Catmull-Rom → cubic at the app's own `curveSmoothness`
0.3, a coral→transparent gradient fill, a ringed dot on the **latest** bucket only), the gauge and
donut are `stroke-dasharray` arcs, the heatmap and waffle are CSS grids, the leaderboard and
breakdown table are flex rows with a share bar behind them. All server components, so every figure
is in the first paint.

The tooltip is a `<title>` inside each hover target — no listener, no state, and a screen reader
reads the values as a list, which `fl_chart`'s gesture tooltip cannot offer at all.

Two palette rules carry over from `chart_theme.dart` and are load-bearing:

- **A bad outcome never wears the brand coral.** Completed is `success-text`, no-shows
  `error-text`, cancelled `border-strong`. Coral is the one accent, for the trend line, the gauge
  arc, share bars and the hot end of the heatmap.
- **A zero heat cell stays canvas white, not the cold end of the ramp.** On a single-hue ramp "no
  bookings ever" and "one booking" would be two barely-different pinks, and a salon closed on
  Sunday would look faintly busy.

### Do not mix a period's figures with the month's

The goal card is always about the **calendar month** — `goal.monthToDateRevenue` and
`monthly_goal` both are, whatever the period pills say — but `kpis.avgTicket` is scoped to the
*selected* period. Dividing a monthly shortfall by a weekly average ticket is how the app arrives
at *"258 more bookings closes the gap"*, measured on Norzin's weekly view. So the ticket
restatement is offered **only** at monthly granularity; every other period states the shortfall
plainly.

### `offerHiddenReason` compares Thimphu days, not UTC ones

`offers_public_read` filters on `(now() at time zone 'Asia/Thimphu')::date`, so anything deciding
whether an offer has lapsed has to as well. Comparing UTC calendar days makes the owner's page and
the customer's disagree for the six hours of every Thimphu day that fall on the previous UTC one —
measured: an offer that had ended still read **"Live"** at 04:20 Thimphu while customers had
already stopped seeing it. Use `thimphuToday(now)`; there is a test pinning the boundary.

### The owner's notifications are addressed to a person, not a salon

`notifications.recipient_profile_id` is the only routing there is, and
`private.enqueue_order_notification` sends the salon's copies to `business_owner_profile(...)`.
So the owner's feed spans **every** salon they run, switching salons changes nothing, and a linked
stylist receives none of it. The page says so.

**And the payload holds `start_ts` and nothing else** — often not even that
(`booking_cancelled` and `order_placed` arrive as `{}`). No `private.enqueue_*` function writes a
customer name. An earlier draft of `ownerNotificationText` read `payload.customer_name` so a row
could say *"New booking — Pema, Fri 11:30"*, which is **the same mistake this repo criticises the
app for** at `notifications_screen.dart` (it renders `payload['message']`, a key the server has
never written). Say only what the row can support.

### Orders are forward-only, so there is no Undo — and there are two lifecycles

Still forward-only, and **more** so than this section used to say. `20260814000006` split the tail
of the lifecycle in two and gated each half on the order's own `fulfilment`:

```
pickup:    new → ready → collected
delivery:  new → ready → out_for_delivery → delivered
either:    new|ready → declined      (owner, reason required)
           new       → cancelled     (customer)
```

Every case is one-directional or terminal, so `canOwnerTransition` is never true for a reverse move
and an Undo button could only ever fail. A decline **requires a reason**, the customer reads it in
their `order_declined` notification, and a decline is **refused once the order is out for
delivery** — the goods have left the shop.

**`fulfilment` is a required argument to `canOwnerTransition`, not an optional hint.** The server
refuses `ready → collected` on a delivery order and `ready → out_for_delivery` on a pickup one, so a
signature a caller could forget is a signature that offers a button which always raises. Read it
through `orderFulfilment(order)`, the one named place that decides.

**And the four checkout columns are `not null`, which this paragraph used to deny.** It said a null
`fulfilment` meant an order placed before the checkout migration — the sentence was repeated into
`Order`'s doc comments, into `OrderLines`' `!= null` guard and its `!` assertion, and into
`toOrder`'s choice of `numOrNull`. It was never true:
`20260814000003_orders_checkout_columns.sql` adds `subtotal_nu`, `discount_nu` and
`delivery_fee_nu` as `int not null default 0`, adds `fulfilment` as `text not null default
'pickup'`, and then backfills `subtotal_nu` from `total_nu` on the grounds that before the slice a
total *was* a subtotal. Measured on the live database 2026-08-18: `is_nullable = NO` on all four,
and of 10 orders, 0 hold a null, 0 hold a zero subtotal, 0 have a subtotal differing from the
total. A pre-checkout row is an exact pickup order with no discount and no fee — which is what it
always was. **The rule this cost:** a claim about a column is checked against
`information_schema`, not against the sentence next to it.

**Every `OrderStatus` must be in exactly one `ORDER_SEGMENTS` entry.** The owner's inbox filters
`.in("status", segment.statuses)`, so a status in no segment is an order in **no list** — which is
exactly what happened to the two new values for four days: live rows, invisible in the console,
nothing on screen to suggest they existed. `orderSegmentCoverage()` and its test are the guard.

**And the total is not the sum of the lines.** `place_order` computes `subtotal − discount +
delivery fee`, where the discount is a promo code, points spent at checkout, or both. `OrderLines`
renders the breakdown when there is one to render; `discount_nu` is a **positive magnitude**, so the
minus sign belongs to the display — the same rule, and the same trap, as `payments`.

Restoring an order during verification needs direct SQL: nothing in the schema can move a status
backwards.

### A walk-in has no client page

`client_book` returns a null `customer_profile_id` for anyone the salon knows only from the
counter, grouped by `walkin:<name>:<phone>`. There is nothing to open — `client_history` takes a
profile id and `client_notes.customer_profile_id` is `not null` — so those rows are rendered as
plain rows rather than links. The app pushes a detail screen and then hides both of its sections.

**"Lapsed" is the salon's own rebooking window** (`businesses.rebooking_days`), never a constant.
Verified by moving Norzin's from 42 to 10 to 3 and watching the same two clients cross the line
and back.

### `plan_change_requests` can never be withdrawn

INSERT and SELECT policies, and nothing else — so the table-wide UPDATE and DELETE grants are
dead. **Not with an error, either:** measured, an owner's `update … set status='cancelled'`
succeeds having affected **0 rows**, because with no policy for the command the rows are not
visible to it. A "withdraw" button would report success and change nothing, which is why none is
offered and why the writer de-duplicates *before* inserting. Norzin already carries two pending
`pro` requests and a pending `growth` request for the plan it is already on, all left by the old
app flow.

`status` is in the insert grant and `pcr_insert`'s WITH CHECK does not constrain it, so an owner
*can* file a request already marked `done` and hide it from the operator's queue. Never write that
column; the default is `pending`.

### Offers are writable by staff, not just the owner

`offers_member_write` is `ALL using private.is_business_member` — every other owner-configured
table uses `is_business_owner`. Measured: Norzin's linked stylist can insert, edit **and
hard-delete** offers, while the same account is refused on `products` and `loyalty_rewards` with
`42501`. Since `offers_public_read` puts them on the salon page and in the customer feed, a
stylist can publish a discount in the salon's name. Reported upstream; the console only ever acts
as the owner.
