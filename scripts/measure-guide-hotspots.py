"""Measure the guide's highlight rings, in both viewports.

    npm run dev
    python scripts/measure-guide-hotspots.py            # both, all steps
    python scripts/measure-guide-hotspots.py phone      # one viewport

Prints `x/y/w/h` as percentages of the frame, ready to paste into the `hotspot` fields in
`lib/guide/steps.ts`, plus the text of whatever it measured so the number can be checked
without opening the picture.

## Why the highlights are measured rather than eyeballed

A ring drawn by eye is right on the screenshot it was drawn against and wrong on the next
capture. Here each step names **what it points at** as a DOM expression, once, and that one
definition is measured against both the 1280x800 and the 390x844 layouts — which is also the
only honest way to have two frame sets: the same control is in a different place in each, and
guessing twice is guessing twice.

The percentages are of the *viewport*, because that is the box the screenshot is, and the
player scales the whole frame to whatever width it has. Anything absolute would drift on
every screen but the capture's.

**Run this after `capture-guide-frames.py`, and paste the result back.** The two scripts
share their sign-in, their salon and their route list by convention rather than by import —
keep them in step.
"""

import pathlib
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:3000"
PASSWORD = "Password123!"
NORZIN_ID = "0b000000-0000-4000-8000-000000000001"
NORZIN_SLUG = f"norzin-salon-and-spa-{NORZIN_ID}"

VIEWS = {
    "wide": {"view": {"width": 1280, "height": 800}, "mobile": False, "dsf": 1},
    "phone": {"view": {"width": 390, "height": 844}, "mobile": True, "dsf": 2},
}

# The union of these elements' boxes is the ring, padded by `PAD`. Written as expressions
# rather than selectors because several targets are "this control and the two beside it",
# which no single selector says.
#
# `null` means the step has no highlight — the frame is the whole point of it.
CUSTOMER_TARGETS = {
    "01-discover": "[document.querySelector('[role=tablist]'), document.querySelector('a[href=\"/scan\"]')]",
    "02-salon": "[document.querySelector('a[href=\"#services\"]'), document.querySelector('a[href=\"#about\"]')]",
    "03-services": "[document.querySelector('#services h2'), [...document.querySelectorAll('#services button')].find(b => /^Book$/.test((b.textContent ?? '').trim()))]",
    "04-book-service": "[...document.querySelectorAll('button')].filter(b => ['Services','Professional','Time','Confirm'].includes((b.textContent ?? '').trim()))",
    "05-book-professional": "[document.querySelector('button[aria-pressed]')]",
    "06-book-time": "[document.querySelector('ul[aria-label=\"Choose a date\"]')]",
    "07-book-confirm": "[[...document.querySelectorAll('button')].find(b => /^Book\b/.test((b.textContent ?? '').trim()))]",
    "08-bookings": "[document.querySelector('[role=tablist]')]",
    "09-booking-detail": "[[...document.querySelectorAll('*')].find(e => e.textContent?.trim().startsWith('Text and push reminders') && e.children.length === 0)?.closest('div')]",
    "10-queue-join": "[[...document.querySelectorAll('span,div')].find(e => /No queue|in line|waiting/.test(e.textContent ?? '') && e.children.length === 0)]",
    "11-map": "[document.querySelector('input[type=search], input[type=text]')]",
    "12-shop": "[document.querySelector('#shop button')]",
    "13-rewards": "[document.querySelector('main a[href^=\"/salon/\"]')]",
    "14-messages": "[document.querySelector('a[href^=\"/messages/\"]')]",
    "15-notifications": "[...document.querySelectorAll('button[aria-pressed]')].slice(0, 4)",
    "16-profile": None,
}

OWNER_TARGETS = {
    "01-calendar": "[document.querySelector('[role=tablist]')]",
    "02-booking-detail": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
    "03-queue-board": "[[...document.querySelectorAll('a,button')].find(e => /Add walk-?in/i.test(e.textContent ?? ''))]",
    "04-walk-in": "[document.querySelector('input')]",
    "05-insights": "[document.querySelector('a[href=\"/business/orders\"]')]",
    "06-insights-charts": "[document.querySelector('a[href*=\"period=daily\"]'), document.querySelector('a[href*=\"period=annually\"]')]",
    "07-services": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
    "08-staff": "[document.querySelector('a[href^=\"/business/staff/\"]')]",
    "09-hours": "[document.querySelector('input[type=time]')]",
    "10-settings": "[[...document.querySelectorAll('h2')].find(h => /Run the business/i.test(h.textContent ?? ''))]",
    "11-salon-details": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
    "12-orders": "[document.querySelector('a[href*=\"orders?status=new\"]'), document.querySelector('a[href*=\"orders?status=done\"]')]",
    "13-clients": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
    "14-loyalty": "[[...document.querySelectorAll('a,section,div')].find(e => /Redemptions/.test(e.textContent ?? '') && e.textContent.length < 120)]",
    "15-messages": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
    "16-plans": "[document.querySelector('h1'), document.querySelector('h1')?.nextElementSibling]",
}

MEASURE = """
([exprSource, pad]) => {
  const els = (new Function('return ' + exprSource))().filter(Boolean);
  if (els.length === 0) return null;
  const rects = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  const W = window.innerWidth, H = window.innerHeight;
  const pct = (v, total) => Math.round((v / total) * 1000) / 10;
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const x = clamp(pct(left, W) - pad);
  const y = clamp(pct(top, H) - pad);
  return {
    x,
    y,
    w: Math.min(100 - x, pct(right - left, W) + pad * 2),
    h: Math.min(100 - y, pct(bottom - top, H) + pad * 2),
    text: (els[0].textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 58),
  };
}
"""

PAD = 0.8

OUT = pathlib.Path(__file__).resolve().parent.parent / "lib" / "guide" / "hotspots.ts"

# key -> {x, y, w, h}, in the order they were measured.
measured: dict[str, dict] = {}


def key_for(audience, mode, name):
    """The frame's own path under `public/guide/`, which is what `steps.ts` looks up."""
    return f"{audience}/phone/{name}" if mode == "phone" else f"{audience}/{name}"


def write_module():
    """Rewrite `lib/guide/hotspots.ts` — the whole file, every run.

    Generated rather than merged: a partial run should not leave half of one viewport's
    numbers from today beside half of last month's, silently.
    """
    lines = [
        "/**",
        " * Where each guide highlight sits, as percentages of its frame.",
        " *",
        " * **Generated. Do not edit by hand** — `python scripts/measure-guide-hotspots.py`",
        " * rewrites this whole file from the running app, and anything typed in here is lost on",
        " * the next run.",
        " *",
        " * The split is the point: this file is *geometry*, `steps.ts` is *words*. Each step names",
        " * what it points at once, as a DOM expression in the measuring script, and that one",
        " * definition is measured against both the 1280x800 and the 390x844 layouts — because the",
        " * same control is in a different place in each, and eyeballing it twice is guessing twice.",
        " * A re-capture can therefore move every ring in the product without touching a sentence.",
        " *",
        " * A key with no entry yields no highlight, which is the honest failure: a frame with no",
        " * ring still teaches, and a ring in the wrong place lies.",
        " *",
        " * Keys are the frame's path under `public/guide/`, without the extension.",
        " */",
        "export type HotspotBox = { x: number; y: number; w: number; h: number };",
        "",
        "export const HOTSPOTS: Record<string, HotspotBox> = {",
    ]
    for key in sorted(measured):
        b = measured[key]
        lines.append(f'  "{key}": {{ x: {b["x"]}, y: {b["y"]}, w: {b["w"]}, h: {b["h"]} }},')
    lines.append("};")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"\nwrote lib/guide/hotspots.ts with {len(measured)} boxes"
    )


def sign_in(page, email):
    for attempt in range(4):
        page.goto(f"{BASE}/sign-in", wait_until="networkidle")
        page.wait_for_timeout(1200 + attempt * 800)
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password", exact=True).fill(PASSWORD)
        if page.get_by_label("Email").input_value() != email:
            continue
        page.get_by_role("button", name="Sign in").click()
        try:
            page.wait_for_url(lambda u: "/sign-in" not in u, timeout=15000)
            page.wait_for_load_state("networkidle")
            return
        except PWTimeout:
            continue
    raise RuntimeError(email)


def settle(page):
    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except PWTimeout:
        pass
    page.wait_for_timeout(1200)


def measure(page, key, name, expr):
    """Measure one highlight and remember it under its frame's own path."""
    if expr is None:
        print(f"    {name:22s} (no highlight)")
        return
    try:
        result = page.evaluate(MEASURE, [expr, PAD])
    except Exception as exc:
        print(f"    {name:22s} ERROR {str(exc)[:60]}")
        return
    if not result:
        print(f"    {name:22s} NOT FOUND")
        return
    measured[key] = {k: round(result[k], 1) for k in ("x", "y", "w", "h")}
    print(
        f"    {name:22s} {{ x: {result['x']}, y: {result['y']}, "
        f"w: {result['w']}, h: {result['h']} }}   <- {result['text']!r}"
    )


def open_section(page, name):
    page.get_by_role("link", name=name, exact=True).first.click(timeout=8000)
    page.wait_for_timeout(1500)


def run_customer(browser, mode):
    cfg = VIEWS[mode]
    page = browser.new_context(
        viewport=cfg["view"], device_scale_factor=cfg["dsf"],
        is_mobile=cfg["mobile"], has_touch=cfg["mobile"],
    ).new_page()
    sign_in(page, "customer@bhutansalons.test")
    print(f"\n  --- customer / {mode} ---")

    steps = [
        ("01-discover", "/discover", None),
        ("02-salon", f"/salon/{NORZIN_SLUG}", None),
        ("03-services", None, lambda p: open_section(p, "Services")),
        ("04-book-service", f"/salon/{NORZIN_ID}/book", None),
        (
            "05-book-professional",
            f"/salon/{NORZIN_ID}/book?service=0d000000-0000-4000-8000-000000000001&step=professional",
            None,
        ),
        ("08-bookings", "/bookings", None),
        ("10-queue-join", f"/q/{NORZIN_ID}", None),
        ("11-map", "/map", None),
        ("12-shop", f"/salon/{NORZIN_SLUG}", lambda p: open_section(p, "Shop")),
        ("13-rewards", "/rewards", None),
        ("14-messages", "/messages", None),
        ("15-notifications", "/notifications", None),
    ]
    for name, path, prepare in steps:
        if path:
            page.goto(BASE + path, wait_until="domcontentloaded")
        settle(page)
        if prepare:
            prepare(page)
            settle(page)
        measure(page, key_for("customer", mode, name), name, CUSTOMER_TARGETS[name])

    # The wizard's later steps have to be walked to, exactly as the capture walks them.
    page.goto(f"{BASE}/salon/{NORZIN_ID}/book", wait_until="networkidle")
    settle(page)
    page.get_by_role("button", name="Haircut & Style").first.click()
    page.wait_for_timeout(600)
    page.get_by_role("button", name="Continue").first.click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Any professional").first.click()
    page.wait_for_timeout(600)
    page.get_by_role("button", name="Continue").first.click()
    page.wait_for_timeout(3000)
    dates = page.locator("ul[aria-label='Choose a date'] button")
    slots = page.locator("button[aria-pressed]")
    for i in range(min(dates.count(), 7)):
        dates.nth(i).click()
        page.wait_for_timeout(2400)
        if slots.count() > 3:
            break
    settle(page)
    measure(page, key_for("customer", mode, "06-book-time"), "06-book-time", CUSTOMER_TARGETS["06-book-time"])

    page.locator("button[aria-pressed]").last.click()
    page.wait_for_timeout(800)
    page.get_by_role("button", name="Continue").first.click()
    page.wait_for_timeout(2500)
    settle(page)
    measure(page, key_for("customer", mode, "07-book-confirm"), "07-book-confirm", CUSTOMER_TARGETS["07-book-confirm"])
    measure(page, key_for("customer", mode, "16-profile"), "16-profile", CUSTOMER_TARGETS["16-profile"])


def run_owner(browser, mode):
    cfg = VIEWS[mode]
    page = browser.new_context(
        viewport=cfg["view"], device_scale_factor=cfg["dsf"],
        is_mobile=cfg["mobile"], has_touch=cfg["mobile"],
    ).new_page()
    sign_in(page, "owner@bhutansalons.test")
    page.goto(f"{BASE}/business", wait_until="networkidle")
    try:
        page.locator("select").first.select_option(label="Norzin Salon & Spa", timeout=4000)
        page.wait_for_load_state("networkidle")
    except Exception:
        pass
    print(f"\n  --- owner / {mode} ---")

    routes = {
        "01-calendar": "/business",
        "03-queue-board": "/business/queue",
        "04-walk-in": "/business/walk-in",
        "05-insights": "/business/insights",
        "07-services": "/business/services",
        "08-staff": "/business/staff",
        "09-hours": "/business/hours",
        "10-settings": "/business/settings",
        "11-salon-details": "/business/settings/salon",
        "12-orders": "/business/orders",
        "13-clients": "/business/clients",
        "14-loyalty": "/business/loyalty",
        "15-messages": "/business/messages",
        "16-plans": "/business/plans",
    }
    for name, path in routes.items():
        page.goto(BASE + path, wait_until="domcontentloaded")
        settle(page)
        measure(page, key_for("owner", mode, name), name, OWNER_TARGETS[name])

    href = page.eval_on_selector_all(
        "a[href^='/business/bookings/']", "e => e.map(x => x.getAttribute('href'))[0] || ''"
    )
    page.goto(BASE + (href or "/business"), wait_until="domcontentloaded")
    settle(page)
    measure(page, key_for("owner", mode, "02-booking-detail"), "02-booking-detail", OWNER_TARGETS["02-booking-detail"])

    page.goto(f"{BASE}/business/insights", wait_until="domcontentloaded")
    settle(page)
    page.locator("h2:has-text('Trends')").first.scroll_into_view_if_needed()
    page.evaluate("() => window.scrollBy(0, -96)")
    page.wait_for_timeout(600)
    measure(page, key_for("owner", mode, "06-insights-charts"), "06-insights-charts", OWNER_TARGETS["06-insights-charts"])


def main():
    args = sys.argv[1:]
    modes = [m for m in args if m in VIEWS] or list(VIEWS)
    audiences = [a for a in args if a in ("customer", "owner")] or ["customer", "owner"]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for mode in modes:
            if "customer" in audiences:
                run_customer(browser, mode)
            if "owner" in audiences:
                run_owner(browser, mode)
        browser.close()

    write_module()


if __name__ == "__main__":
    main()
