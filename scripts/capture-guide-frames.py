"""Re-take the screenshots behind the in-product guide.

    npm run dev                                        # in one terminal
    python scripts/capture-guide-frames.py             # every frame, both viewports
    python scripts/capture-guide-frames.py customer    # one audience
    python scripts/capture-guide-frames.py owner phone # one audience, one viewport

Writes the frames `lib/guide/steps.ts` names:

    public/guide/{customer,owner}/*.webp          the 1280x800 captures
    public/guide/{customer,owner}/phone/*.webp    the 390x844 ones

## Why two sets

The guide is mostly read on a phone, and a desktop screenshot shown 358px wide is a picture
of a layout that phone will never render, at a size nobody can read. So every step has two
frames and the player picks by viewport. They are captures of the *same route* — the
difference between them is the app's own responsive behaviour, which is the thing worth
showing.

## Why this script exists at all

The guide's whole claim is that it shows the app as it is today. A hand-drawn tour starts
lying the first time a button moves; this one is re-runnable, so when a screen changes the
fix is to run this rather than to redraw anything. **Re-run it whenever a route in
`lib/guide/steps.ts` changes shape**, then re-run `scripts/measure-guide-hotspots.py` and
paste the percentages back — the highlights are measured against these exact viewports.

Requires the dev server on :3000, the seeded logins (see `../tho/supabase/seed.sql`) and
`pip install playwright && playwright install chromium`.

## Six things that are load-bearing, all learned the hard way

- **Sign-in waits for hydration.** Filling before React has hydrated puts the value in the
  DOM but not in the controlled state, and the press then does a *native* form submit that
  clears the form. It fails silently and looks like a wrong password. `sign_in` proves
  hydration by reading the value back before pressing.
- **The book route takes the raw uuid, not the slug.** The salon page resolves either; the
  booking route 404s on a slug, and the first run captured the "This page isn't here"
  boundary without noticing.
- **A slot in the booking wizard is a button carrying `aria-pressed`, not a radio.**
  (`SlotChip`'s radio-in-a-label is the *reschedule* flow.) And a professional row's "Select"
  pill is `aria-hidden`, so its accessible name is the stylist, never "Select".
- **Today usually has no free slot**, so the wizard's time step is captured by walking the
  date strip to a day that does. An honest "Nothing free that day" is a useless guide frame.
- **Sections are reached by their own links, never by a pixel scroll.** The salon page's
  Services / Shop / Team are anchors, and the offset that lands on Shop at 1280 lands on
  nothing at 390. Scrolling to a *named element* is the only thing that works in both.
- **`nextjs-portal` and the guide's own launcher are hidden before every shot.** The first is
  the dev-server indicator; the second is real chrome, but chrome about the guide rather than
  about the workflow, and a tour whose every frame contains the button that opened it is a
  distraction wearing a recursion.
"""

import base64
import pathlib
import re
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:3000"
PASSWORD = "Password123!"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "guide"

# The two capture boxes. The hotspots in `lib/guide/steps.ts` are percentages of these, and
# the player renders each frame at the matching ratio — change a viewport here and every
# hotspot measured against it moves.
#
# The phone frames are taken at 2x and written at 780 wide so they stay sharp on a retina
# screen, where they are displayed at roughly their capture width. The wide ones are
# displayed far smaller than they were taken and need no such margin.
MODES = {
    "wide": {
        "view": {"width": 1280, "height": 800},
        "dsf": 1,
        "mobile": False,
        "dir": "",
        "encode_width": 1280,
        "quality": 0.82,
    },
    "phone": {
        "view": {"width": 390, "height": 844},
        "dsf": 2,
        "mobile": True,
        "dir": "phone/",
        "encode_width": 780,
        "quality": 0.74,
    },
}

# Norzin Salon & Spa: the only Pro salon, and the only one with products, a loyalty
# programme, orders and a full booking history — so it is the one salon where every surface
# in both guides has something real in it.
NORZIN_ID = "0b000000-0000-4000-8000-000000000001"
NORZIN_SLUG = f"norzin-salon-and-spa-{NORZIN_ID}"

report: list[tuple[str, str, str]] = []


def settle(page):
    """Wait for the page to stop moving, then stop it moving."""
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PWTimeout:
        pass
    # Every wait is raced against a deadline: a lazily-loaded image below the fold never
    # fires load or error until it is scrolled to, so an unraced `Promise.all` over
    # `document.images` hangs for ever rather than settling.
    page.evaluate(
        """async () => {
            const cap = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
            await cap(document.fonts.ready, 3000);
            await cap(Promise.all(Array.from(document.images)
              .filter(i => !i.complete && i.getAttribute('loading') !== 'lazy')
              .map(i => new Promise(r => { i.onload = i.onerror = r; }))), 4000);
        }"""
    )
    page.add_style_tag(
        content="*,*::before,*::after{animation-duration:0s!important;"
        "animation-delay:0s!important;transition-duration:0s!important}"
        "nextjs-portal{display:none!important}"
        "button[aria-label^='How Tho works'],"
        "button[aria-label^='How the salon console works']{display:none!important}"
    )
    page.wait_for_timeout(500)


def save(page, mode, name):
    """PNG out of Playwright, WebP in — re-encoded by the browser's own canvas encoder.

    Playwright writes PNG or JPEG only, and there is no image library in this environment.
    Chromium has a perfectly good WebP encoder, and it is already open.
    """
    cfg = MODES[mode]
    png = page.screenshot(type="png")
    data_url = page.evaluate(
        """async ([b64, width, quality]) => {
            const img = new Image();
            img.src = 'data:image/png;base64,' + b64;
            await img.decode();
            const scale = Math.min(1, width / img.naturalWidth);
            const c = document.createElement('canvas');
            c.width = Math.round(img.naturalWidth * scale);
            c.height = Math.round(img.naturalHeight * scale);
            const ctx = c.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, c.width, c.height);
            return c.toDataURL('image/webp', quality);
        }""",
        [base64.b64encode(png).decode(), cfg["encode_width"], cfg["quality"]],
    )
    raw = base64.b64decode(data_url.split(",", 1)[1])
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    report.append((name, "ok", f"{len(raw) // 1024}KB"))
    print(f"  OK  {name:40s} {len(raw) // 1024:4d}KB  {page.url.replace(BASE, '')}")


def scroll_to(page, selector, offset=96):
    """Put a named element just below the sticky header.

    A pixel scroll cannot be shared between viewports — 900 lands on the salon's price list
    at 1280 and halfway through its photos at 390 — so every scrolled frame names what it
    wants to be looking at.
    """
    page.locator(selector).first.scroll_into_view_if_needed()
    page.evaluate("off => window.scrollBy(0, -off)", offset)
    page.wait_for_timeout(500)


def shot(page, mode, path, name, *, prepare=None):
    """One frame. A failure is reported and skipped — a missing frame is not worth losing
    the other sixty-three to."""
    audience, leaf = name.split("/", 1)
    full = f"{audience}/{MODES[mode]['dir']}{leaf}"
    try:
        if path is not None:
            try:
                page.goto(BASE + path, wait_until="domcontentloaded")
            except Exception:
                # `net::ERR_ABORTED` is a superseded navigation, not a broken page. One
                # retry; it is transient and it took a whole run down once.
                page.wait_for_timeout(1200)
                page.goto(BASE + path, wait_until="domcontentloaded")
        settle(page)
        if prepare:
            prepare(page)
            settle(page)
        save(page, mode, full)
    except Exception as exc:
        report.append((full, "FAIL", str(exc)[:90]))
        print(f"  !!  {full:40s} FAILED: {str(exc)[:110]}")


def sign_in(page, email):
    for attempt in range(4):
        page.goto(f"{BASE}/sign-in", wait_until="networkidle")
        page.wait_for_timeout(1200 + attempt * 800)
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password", exact=True).fill(PASSWORD)
        # The hydration proof: React owns this value, so reading it back means the form is
        # live and the press will run its submit handler rather than a native submit.
        if page.get_by_label("Email").input_value() != email:
            continue
        page.get_by_role("button", name="Sign in").click()
        try:
            page.wait_for_url(lambda u: "/sign-in" not in u, timeout=15000)
            page.wait_for_load_state("networkidle")
            return
        except PWTimeout:
            continue
    raise RuntimeError(f"could not sign in as {email}")


def first_href(page, prefix):
    """The first link starting with `prefix`, or "" — and never an exception.

    This runs *between* frames, outside any `shot`, so a throw here ends the whole run
    rather than costing one picture. That is not a hypothetical: it is how the first phone
    pass stopped after seven frames.
    """
    try:
        return page.eval_on_selector_all(
            f"a[href^='{prefix}']", "e => e.map(x => x.getAttribute('href'))[0] || ''"
        )
    except Exception as exc:
        print(f"  (no {prefix} link: {str(exc)[:60]})")
        return ""


def open_section(name):
    """The salon page's sections are anchors, not tabs — a tab query parameter is ignored."""

    def go(page):
        page.get_by_role("link", name=name, exact=True).first.click(timeout=8000)
        page.wait_for_timeout(1600)

    return go


def context_for(browser, mode):
    cfg = MODES[mode]
    return browser.new_context(
        viewport=cfg["view"],
        device_scale_factor=cfg["dsf"],
        is_mobile=cfg["mobile"],
        has_touch=cfg["mobile"],
    )


def capture_customer(browser, mode):
    page = context_for(browser, mode).new_page()
    sign_in(page, "customer@bhutansalons.test")
    print(f"customer / {mode} signed in -> {page.url}")

    shot(page, mode, "/discover", "customer/01-discover.webp")
    shot(page, mode, f"/salon/{NORZIN_SLUG}", "customer/02-salon.webp")
    shot(page, mode, None, "customer/03-services.webp", prepare=open_section("Services"))
    shot(page, mode, f"/salon/{NORZIN_ID}/book", "customer/04-book-service.webp")

    def to_professional(p):
        p.get_by_role("button", name="Haircut & Style").first.click(timeout=10000)
        p.wait_for_timeout(500)
        p.get_by_role("button", name="Continue").first.click()
        p.wait_for_timeout(1500)

    shot(page, mode, None, "customer/05-book-professional.webp", prepare=to_professional)

    def to_time(p):
        # By the stylist's name: the "Select" pill beside it is `aria-hidden`.
        p.get_by_role("button", name="Any professional").first.click(timeout=10000)
        p.wait_for_timeout(600)
        p.get_by_role("button", name="Continue").first.click()
        p.wait_for_timeout(3000)
        slots = p.locator("button[aria-pressed]").filter(has_text=re.compile(r"\d{1,2}:\d{2}"))
        dates = p.locator("ul[aria-label='Choose a date'] button")
        for i in range(min(dates.count(), 7)):
            dates.nth(i).click()
            p.wait_for_timeout(2600)
            if slots.count() > 0:
                return
        raise RuntimeError("no bookable day in the next week")

    shot(page, mode, None, "customer/06-book-time.webp", prepare=to_time)

    def to_confirm(p):
        p.locator("button[aria-pressed]").filter(
            has_text=re.compile(r"\d{1,2}:\d{2}")
        ).first.click(timeout=10000)
        p.wait_for_timeout(800)
        p.get_by_role("button", name="Continue").first.click()
        p.wait_for_timeout(2500)

    shot(page, mode, None, "customer/07-book-confirm.webp", prepare=to_confirm)

    shot(page, mode, "/bookings", "customer/08-bookings.webp")
    href = first_href(page, "/bookings/")
    shot(page, mode, href or "/bookings", "customer/09-booking-detail.webp")
    shot(page, mode, f"/q/{NORZIN_ID}", "customer/10-queue-join.webp")
    shot(page, mode, "/map", "customer/11-map.webp")
    shot(page, mode, f"/salon/{NORZIN_SLUG}", "customer/12-shop.webp", prepare=open_section("Shop"))
    shot(page, mode, "/rewards", "customer/13-rewards.webp")
    shot(page, mode, "/messages", "customer/14-messages.webp")
    shot(page, mode, "/notifications", "customer/15-notifications.webp")
    shot(page, mode, "/profile", "customer/16-profile.webp")


def capture_owner(browser, mode):
    page = context_for(browser, mode).new_page()
    sign_in(page, "owner@bhutansalons.test")
    print(f"owner / {mode} signed in -> {page.url}")

    # The seeded owner runs nine salons and only Norzin is Pro, so it is the only one where
    # insights, payroll and the queue board render their unlocked branch.
    page.goto(f"{BASE}/business", wait_until="networkidle")
    try:
        page.locator("select").first.select_option(label="Norzin Salon & Spa", timeout=4000)
        page.wait_for_load_state("networkidle")
    except Exception as exc:
        print(f"  (salon switcher: {str(exc)[:70]})")

    shot(page, mode, "/business", "owner/01-calendar.webp")
    href = first_href(page, "/business/bookings/")
    shot(page, mode, href or "/business", "owner/02-booking-detail.webp")
    shot(page, mode, "/business/queue", "owner/03-queue-board.webp")
    shot(page, mode, "/business/walk-in", "owner/04-walk-in.webp")
    shot(page, mode, "/business/insights", "owner/05-insights.webp")

    def to_trends(p):
        # Named, not measured: the trend chart is 620px down at 1280 and far further at 390.
        scroll_to(p, "h2:has-text('Trends')")

    shot(page, mode, None, "owner/06-insights-charts.webp", prepare=to_trends)
    shot(page, mode, "/business/services", "owner/07-services.webp")
    shot(page, mode, "/business/staff", "owner/08-staff.webp")
    shot(page, mode, "/business/hours", "owner/09-hours.webp")
    shot(page, mode, "/business/settings", "owner/10-settings.webp")
    shot(page, mode, "/business/settings/salon", "owner/11-salon-details.webp")
    shot(page, mode, "/business/orders", "owner/12-orders.webp")
    shot(page, mode, "/business/clients", "owner/13-clients.webp")
    shot(page, mode, "/business/loyalty", "owner/14-loyalty.webp")
    shot(page, mode, "/business/messages", "owner/15-messages.webp")
    shot(page, mode, "/business/plans", "owner/16-plans.webp")


def main():
    args = sys.argv[1:]
    audiences = [a for a in args if a in ("customer", "owner")] or ["customer", "owner"]
    modes = [m for m in args if m in MODES] or list(MODES)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for mode in modes:
            if "customer" in audiences:
                capture_customer(browser, mode)
            if "owner" in audiences:
                capture_owner(browser, mode)
        browser.close()

    failed = [r for r in report if r[1] != "ok"]
    print(f"\n{len(report) - len(failed)} captured, {len(failed)} failed")
    for name, status, detail in failed:
        print(f"  {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
