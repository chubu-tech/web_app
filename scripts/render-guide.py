#!/usr/bin/env python3
"""Render the walkthrough MP4s by seeking the timeline the site's own tests cover.

`lib/guide/timeline.ts` states the arrangement this script is the other half of: the motion
design is arithmetic, `stateAt(timeline, t)`, and both renderers read it rather than owning
a copy. So there is no motion design in this file. It sets `t`, screenshots, and hands the
result to ffmpeg.

That is what makes the film trustworthy: the camera pushes, rings, taps and cross-fades in
the video are the ones 78 unit tests already assert, not a second implementation that merely
looks similar.

How it runs:

  * `scripts/guide-stage/stage.ts` is bundled by **esbuild**, which is already in
    `node_modules` as a transitive dependency — no new package, no build step to maintain.
  * `web/` is served over a local static server, because ES module imports and `webp`
    loading from `file://` are a fight not worth having.
  * Headless Chromium (the Playwright browser already installed on this machine) is sized
    to exactly 1920x1080 at `deviceScaleFactor: 1`, so a screenshot is a video frame with
    no resampling anywhere.
  * Frames whose visual state is byte-identical to the previous one are **not
    re-screenshotted** — the file is copied instead. A guide holds a still screen for
    seconds at a time, so this is most of the run.

Usage:
    python scripts/render-guide.py --check                  # timings only, nothing rendered
    python scripts/render-guide.py --still customer:42      # one PNG, for reviewing the look
    python scripts/render-guide.py --audience customer      # one MP4
    python scripts/render-guide.py                          # both

Output:
    .guide-masters/<audience>-picture.mp4     the silent master, not served
    public/guide/video/<audience>-poster.webp
"""

from __future__ import annotations

import argparse
import asyncio
import functools
import http.server
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STAGE = REPO / "scripts" / "guide-stage"
BUNDLE = STAGE / "stage.js"
OUT = REPO / "public" / "guide" / "video"
MASTERS = REPO / ".guide-masters"

# Only the finished film belongs under `public/`. Everything there is uploaded to the CDN and
# is publicly fetchable, and the two intermediates per audience come to 110 MB that no visitor
# ever requests - so the picture and the picture-plus-voice live outside it, gitignored,
# derived and regenerable. `-poster.webp` and the final mux are the only outputs that ship.
WORK = REPO / ".next" / "cache" / "guide-render"

# COLOUR
#
# The frames arrive as JPEG, and JPEG is full-range YUV with a BT.601 matrix. Encoded without
# a conversion, the H.264 inherits both: `yuvj420p`, `color_range=pc`, `color_space=bt470bg` -
# a self-consistent file that ffmpeg reads back to within a level of the stage that drew it.
#
# Chromium does not read it back that way. It expands the already-full range as though it were
# limited, so 248 becomes (248-16) x 255/219 = 270 and clips. Measured against the stage: the
# cream canvas arrived as pure white, 14 levels out, and every tone in the light end of a film
# that is mostly light end went with it. Black and white both survive - they clip to
# themselves - so the error hides from any check that only looks at the extremes.
#
# Converting to limited range with the BT.709 matrix, and tagging it as such, is what every
# other H.264 on the web is. Same comparison after the change: within 3 levels.
FPS = 30
WIDTH, HEIGHT = 1920, 1080
AUDIENCES = ("customer", "owner")

# Roughly where in the film to look for a poster. Not the poster time itself: a blind
# fraction landed 1.1s inside chapter 3's title card on the customer film, so the still a
# visitor sees before pressing play was two words on an empty ground with no app in it.
# `poster_time` starts here and walks to a frame that actually shows the product.
POSTER_AT = 0.16

# A chapter's card is drawn *over* the first seconds of that chapter's opening step rather
# than sitting between steps, so a time inside a step is not yet proof of a visible app.
# `TIMING.card` is 2s; a second on top of that clears its wipe, and the rest lets the
# callout and ring finish arriving so the poster shows a step making its point.
POSTER_SETTLE = 3.2


def poster_time(steps: list[dict], duration: float) -> float:
    """A moment the film is actually *about*: inside a step, past any card, fully settled."""
    target = duration * POSTER_AT
    for i, step in enumerate(steps):
        end = steps[i + 1]["start"] if i + 1 < len(steps) else duration
        if end < target:
            continue
        # Needs room for the settle and still a second of held frame after it, or the
        # poster catches the callout mid-fade on its way out.
        if end - step["start"] >= POSTER_SETTLE + 1.0:
            return step["start"] + POSTER_SETTLE
    return target


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def bundle() -> None:
    """Compile the stage to one ES module Chromium can load."""
    esbuild = REPO / "node_modules" / ".bin" / ("esbuild.cmd" if sys.platform == "win32" else "esbuild")
    if not esbuild.exists():
        sys.exit("esbuild not found in node_modules — run `npm install` first.")
    run([
        str(esbuild),
        str(STAGE / "stage.ts"),
        "--bundle",
        "--format=esm",
        "--target=chrome120",
        f"--outfile={BUNDLE}",
        "--log-level=warning",
    ])


class Server:
    """A static server rooted at `web/`, so the stage can reach `/public/guide/app/**`."""

    def __init__(self) -> None:
        handler = functools.partial(QuietHandler, directory=str(REPO))
        # Port 0 lets the OS pick, so a stale run cannot collide with this one.
        self._srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
        self.port = self._srv.server_address[1]
        self._thread = threading.Thread(target=self._srv.serve_forever, daemon=True)

    def __enter__(self) -> "Server":
        self._thread.start()
        return self

    def __exit__(self, *_) -> None:
        self._srv.shutdown()
        self._srv.server_close()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args) -> None:  # noqa: D102 - a request log per frame is noise
        pass


async def open_stage(page, port: int, audience: str) -> float:
    """Load the stage and return the guide's duration in seconds."""
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    await page.goto(f"http://127.0.0.1:{port}/scripts/guide-stage/stage.html")
    try:
        duration = await page.evaluate("(a) => window.__stage.init(a)", audience)
    except Exception as exc:  # noqa: BLE001 - the page's own error is the useful one
        raise SystemExit(f"stage failed to initialise: {exc}\n" + "\n".join(errors)) from exc
    if errors:
        raise SystemExit("stage reported errors:\n" + "\n".join(errors))
    return float(duration)


async def still(audience: str, t: float, dest: Path) -> None:
    from playwright.async_api import async_playwright

    bundle()
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Server() as server:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(
                viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1
            )
            duration = await open_stage(page, server.port, audience)
            if t > duration:
                raise SystemExit(f"{audience} runs {duration:.1f}s; asked for {t}s")
            await page.evaluate("(t) => window.__stage.seek(t)", t)
            await page.screenshot(path=str(dest))
            await browser.close()
    print(f"{dest}  ({audience} at {t:.2f}s of {duration:.1f}s)")


async def render(audience: str, span: tuple[float, float] | None = None) -> None:
    """Encode a film, or the slice of one named by `span`.

    The slice exists because motion cannot be reviewed in stills. A twelve-second clip over
    a chapter boundary shows the card wipe, the layout change behind it and the float
    carrying through the cut — none of which a still can show — and costs half a minute
    instead of twenty.
    """
    from playwright.async_api import async_playwright

    frames = WORK / audience
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)
    OUT.mkdir(parents=True, exist_ok=True)

    with Server() as server:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(
                viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1
            )
            duration = await open_stage(page, server.port, audience)
            poster_at = (
                poster_time(await page.evaluate("() => window.__stage.steps()"), duration)
                if span is None
                else 0.0
            )
            start, end = span if span else (0.0, duration)
            end = min(end, duration)
            first, total = int(start * FPS), int((end - start) * FPS)
            print(f"{audience}: {start:.1f}s..{end:.1f}s -> {total} frames")

            shot = 0

            # Every frame is now unique — the device floats continuously, so no two
            # consecutive states match and the old dedup never fires. Removing it also
            # removes a full `innerHTML` serialisation per frame across the CDP bridge,
            # which was costing more than the screenshot it was trying to avoid.
            #
            # JPEG at 95 rather than PNG: the encode that follows is CRF 20 H.264, which
            # discards far more than this does, and PNG compression of a 1920x1080 frame
            # was a large part of the per-frame cost.
            for i in range(total):
                t = (first + i) / FPS
                await page.evaluate("(t) => window.__stage.seek(t)", t)
                await page.screenshot(path=str(frames / f"{i:06d}.jpg"), type="jpeg", quality=95)
                shot += 1

                if i % (FPS * 20) == 0:
                    print(f"  {t:6.1f}s / {end:.0f}s", flush=True)

            await browser.close()

    print(f"{audience}: {shot} frames, encoding")
    MASTERS.mkdir(exist_ok=True)
    silent = MASTERS / (f"{audience}-picture.mp4" if span is None else f"{audience}-clip.mp4")
    run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-framerate", str(FPS),
        "-i", str(frames / "%06d.jpg"),
        # The colour conversion, and it is not optional - see COLOUR below.
        "-vf", "scale=in_range=full:out_range=limited"
               ":in_color_matrix=bt470bg:out_color_matrix=bt709",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20",
        # Constrained enough that x264 declares Level 4.0 rather than 5.0. At ~1 Mb/s the
        # ceiling never binds; the point is the flag, which is what an older mobile decoder
        # reads before deciding whether it can handle the stream in hardware.
        "-maxrate", "6M", "-bufsize", "12M", "-profile:v", "high", "-level", "4.0",
        "-pix_fmt", "yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-color_range", "tv",
        "-movflags", "+faststart",
        str(silent),
    ])
    if span is None:
        run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(frames / f"{int(poster_at * FPS):06d}.jpg"),
            "-vf", "scale=1280:-1", "-quality", "82",
            str(OUT / f"{audience}-poster.webp"),
        ])
        print(f"{audience}: poster at {poster_at:.1f}s")
    shutil.rmtree(frames, ignore_errors=True)
    size = silent.stat().st_size / 1e6
    print(f"{audience}: {silent.relative_to(REPO)}  {size:.1f} MB")


async def check() -> None:
    """Print the cut without rendering it — the cheap review before a 20-minute encode."""
    from playwright.async_api import async_playwright

    bundle()
    with Server() as server:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
            for audience in AUDIENCES:
                duration = await open_stage(page, server.port, audience)
                steps = await page.evaluate("() => window.__stage.steps()")
                # int() not `:.0f`: rounding turned a 5m51s film into "6m 50.7s".
                mins, secs = int(duration // 60), duration % 60
                print()
                print(f"{audience}: {mins}m {secs:04.1f}s, {len(steps)} steps")
                for i, s in enumerate(steps):
                    nxt = steps[i + 1]["start"] if i + 1 < len(steps) else duration
                    print(f"  {s['start']:6.1f}s  {nxt - s['start']:4.1f}s  {s['frame']}")
            await browser.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audience", choices=AUDIENCES, help="render just one")
    ap.add_argument("--check", action="store_true", help="print timings, render nothing")
    ap.add_argument("--still", metavar="AUDIENCE:SECONDS", help="one PNG, for reviewing the look")
    ap.add_argument("--clip", metavar="AUDIENCE:FROM:TO", help="a short MP4, for reviewing the motion")
    ap.add_argument("--out", type=Path, help="where --still writes")
    args = ap.parse_args()

    if args.check:
        asyncio.run(check())
        return

    if args.still:
        audience, _, seconds = args.still.partition(":")
        if audience not in AUDIENCES or not seconds:
            sys.exit("--still takes AUDIENCE:SECONDS, e.g. customer:42")
        dest = args.out or (WORK / f"still-{audience}-{seconds.replace('.', '_')}.png")
        asyncio.run(still(audience, float(seconds), dest))
        return

    bundle()

    if args.clip:
        audience, _, rest = args.clip.partition(":")
        start, _, end = rest.partition(":")
        if audience not in AUDIENCES or not start or not end:
            sys.exit("--clip takes AUDIENCE:FROM:TO, e.g. customer:12:26")
        asyncio.run(render(audience, (float(start), float(end))))
        return

    for audience in [args.audience] if args.audience else list(AUDIENCES):
        asyncio.run(render(audience))


if __name__ == "__main__":
    main()
