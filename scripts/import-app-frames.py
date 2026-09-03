#!/usr/bin/env python3
"""Bring the Flutter app's captured screens into this repo as guide frames.

`../tho/app/tool/capture_app_tour.sh` drives a real Android emulator through the
app and writes `../tho/docs/screenshots/<pass>/<name>.png` at 1080x2400, plus one
`hotspots.jsonl` per pass holding the measured rectangle of the control each
surface is about. That script's header names this file as the consumer, and this
is it.

What it does, and why each part is the way it is:

* **PNG -> WebP through ffmpeg**, not Pillow. Pillow is not installed on this
  machine and adding a dependency to convert 84 files is not worth it; ffmpeg is
  already here and already a devDependency (`ffmpeg-static`) of this package.

* **One size, 1080 wide** — the source width. `next/image` builds the responsive
  srcset from it, so a second hand-made size would be a copy of work the
  framework already does, kept in sync by hand.

* **Geometry is generated, words are not.** The rings land in
  `lib/guide/hotspots.ts` and the sentences live in `lib/guide/steps.ts`. That
  split is the whole point: a re-capture moves every ring without touching a
  sentence, and nothing in the copy can silently start describing a different
  button.

* **A frame with no measured rect gets no ring**, which is the honest failure. A
  frame without a highlight still teaches; a highlight in the wrong place lies.
  Where a ring genuinely matters and the harness never measured one,
  `lib/guide/hotspots.manual.json` supplies it by hand — and a measured rect
  always wins over a hand-written one, so a later capture pass silently retires
  the manual entry rather than fighting it.

The owner pass emits hotspot names from earlier runs whose PNGs were later
quarantined (the numbering shifted between the Basic and Pro walks). Those names
have no file on disk and are dropped, with a count in the summary so a genuine
mismatch is still visible.

Usage:
    python scripts/import-app-frames.py            # convert what has changed
    python scripts/import-app-frames.py --force    # reconvert everything
    python scripts/import-app-frames.py --check    # report only, write nothing
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO.parent / "tho" / "docs" / "screenshots"
FRAMES_OUT = REPO / "public" / "guide" / "app"
HOTSPOTS_OUT = REPO / "lib" / "guide" / "hotspots.ts"
MANUAL = REPO / "lib" / "guide" / "hotspots.manual.json"

# The capture passes, and the audience each belongs to. `01-auth` is its own
# group rather than being folded into `customer`: both walkthroughs open on the
# same sign-in screens, and duplicating those files so each audience could own a
# copy would mean re-importing one screen twice.
PASSES = {
    "01-auth": "auth",
    "02-customer": "customer",
    "03-owner": "owner",
}

# Every capture is a portrait phone at this size. Asserted rather than assumed:
# a pass captured at a different geometry would put every percentage-based ring
# in the wrong place, and the failure would look like sloppy authoring rather
# than a mixed frame set.
EXPECTED_SIZE = (1080, 2400)

WEBP_QUALITY = "78"


def ffmpeg() -> str:
    """ffmpeg, preferring the one npm already installed for this package."""
    vendored = REPO / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
    if vendored.exists():
        return str(vendored)
    found = shutil.which("ffmpeg")
    if found:
        return found
    sys.exit("x ffmpeg not found — install it, or `npm install` for ffmpeg-static")


FFMPEG = None  # resolved in main(), so --help never shells out


def probe_size(png: Path) -> tuple[int, int] | None:
    """Width and height, via ffprobe beside ffmpeg."""
    probe = Path(FFMPEG).with_name("ffprobe.exe")
    exe = str(probe) if probe.exists() else (shutil.which("ffprobe") or "")
    if not exe:
        return None
    out = subprocess.run(
        [exe, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", str(png)],
        capture_output=True, text=True,
    )
    parts = out.stdout.strip().split(",")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        return None
    return int(parts[0]), int(parts[1])


def convert(png: Path, webp: Path) -> bool:
    """PNG -> WebP. Returns whether ffmpeg reported success."""
    webp.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-i", str(png),
         "-c:v", "libwebp", "-quality", WEBP_QUALITY, "-compression_level", "6",
         str(webp)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"   x {webp.name}: {result.stderr.strip().splitlines()[-1:] or ''}")
        return False
    return webp.exists() and webp.stat().st_size > 0


def read_hotspots(pass_dir: Path) -> dict[str, dict]:
    """The measured rects for one pass, keyed by frame name.

    Later lines win. The file is append-only across capture runs, so the last
    entry for a name is the most recent measurement of it.
    """
    path = pass_dir / "hotspots.jsonl"
    if not path.exists():
        return {}
    found: dict[str, dict] = {}
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
            found[entry["name"]] = {
                "x": float(entry["x"]), "y": float(entry["y"]),
                "w": float(entry["w"]), "h": float(entry["h"]),
            }
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            print(f"   ! {path.name}:{line_no} unreadable, skipped")
    return found


def write_hotspots(boxes: dict[str, dict], manual_used: set[str]) -> None:
    """Emit `lib/guide/hotspots.ts`."""
    lines = [
        "/**",
        " * Where each guide highlight sits, as percentages of its frame.",
        " *",
        " * **Generated. Do not edit by hand** — `python scripts/import-app-frames.py`",
        " * rewrites this whole file from the captures in `../tho/docs/screenshots/`, and",
        " * anything typed in here is lost on the next run. To add a ring the capture",
        " * harness never measured, put it in `hotspots.manual.json` instead; a measured",
        " * rect always wins over a manual one, so a later capture retires it quietly.",
        " *",
        " * The split from `steps.ts` is the point: this file is *geometry*, that one is",
        " * *words*. A re-capture can move every ring without touching a sentence.",
        " *",
        " * Keys are the frame's path under `public/guide/app/`, without the extension.",
        " * A key with no entry yields no highlight — a frame with no ring still teaches,",
        " * and a ring in the wrong place lies.",
        " */",
        "export type HotspotBox = { x: number; y: number; w: number; h: number };",
        "",
        "export const HOTSPOTS: Record<string, HotspotBox> = {",
    ]
    for key in sorted(boxes):
        box = boxes[key]
        note = "  // manual" if key in manual_used else ""
        lines.append(
            f'  "{key}": {{ x: {box["x"]:g}, y: {box["y"]:g}, '
            f'w: {box["w"]:g}, h: {box["h"]:g} }},{note}'
        )
    lines += ["};", ""]
    HOTSPOTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    HOTSPOTS_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    global FFMPEG

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true",
                        help="reconvert frames that are already up to date")
    parser.add_argument("--check", action="store_true",
                        help="report what would happen; write nothing")
    args = parser.parse_args()

    if not SOURCE.exists():
        sys.exit(f"x no captures at {SOURCE} — run ../tho/app/tool/capture_app_tour.sh")

    FFMPEG = ffmpeg()

    boxes: dict[str, dict] = {}
    written = converted = skipped = 0
    ringless: list[str] = []
    orphan_rects = 0
    wrong_size: list[str] = []

    for pass_name, group in PASSES.items():
        pass_dir = SOURCE / pass_name
        if not pass_dir.exists():
            print(f"! {pass_name} missing, skipped")
            continue

        rects = read_hotspots(pass_dir)
        # `_`-prefixed frames are the capture harness's diagnostics, not
        # walkthrough material — it writes one wherever a walk can fail so a
        # bad run can be read from a picture. They stay in the capture set and
        # out of the product.
        pngs = sorted(p for p in pass_dir.glob("*.png") if not p.name.startswith("_"))
        print(f"-> {pass_name} -> public/guide/app/{group}/  ({len(pngs)} frames)")

        for png in pngs:
            name = png.stem
            key = f"{group}/{name}"
            webp = FRAMES_OUT / group / f"{name}.webp"

            size = probe_size(png)
            if size and size != EXPECTED_SIZE:
                wrong_size.append(f"{pass_name}/{name} is {size[0]}x{size[1]}")

            fresh = (
                webp.exists()
                and webp.stat().st_mtime >= png.stat().st_mtime
                and not args.force
            )
            if fresh:
                skipped += 1
            elif args.check:
                converted += 1
            elif convert(png, webp):
                converted += 1
            written += 1

            if name in rects:
                boxes[key] = rects[name]
            else:
                ringless.append(key)

        orphan_rects += len(set(rects) - {p.stem for p in pngs})

    manual_used: set[str] = set()
    if MANUAL.exists():
        try:
            for key, box in json.loads(MANUAL.read_text(encoding="utf-8")).items():
                if key.startswith("_"):
                    continue  # a comment key, by convention
                if key not in boxes:
                    boxes[key] = box
                    manual_used.add(key)
        except json.JSONDecodeError as exc:
            print(f"   ! {MANUAL.name} is not valid JSON ({exc}); manual rings skipped")

    if not args.check:
        write_hotspots(boxes, manual_used)

    print()
    print(f"frames    : {written} ({converted} converted, {skipped} already current)")
    print(f"rings     : {len(boxes)} ({len(manual_used)} hand-measured)")
    if wrong_size:
        print(f"! unexpected geometry — every ring on these is suspect:")
        for line in wrong_size:
            print(f"    {line}")
    if orphan_rects:
        print(f"note      : {orphan_rects} measured rects name a frame that is not on "
              f"disk (quarantined passes) — dropped")
    if ringless:
        print(f"no ring   : {len(ringless)} frames")
        for key in ringless:
            print(f"    {key}")
        print("            add any that matter to lib/guide/hotspots.manual.json")
    if args.check:
        print("\n--check: nothing was written")
    return 1 if wrong_size else 0


if __name__ == "__main__":
    sys.exit(main())
