#!/usr/bin/env python3
"""Bring the app's individual UI components into this repo, for the walkthrough films.

Sibling of `import-app-frames.py`, and the same division of labour: that one imports whole
*screens*, this one imports the *components* those screens are built from. The films need
both — a screen inside the device, and its parts floating around it at different depths, the
way the reference product film decomposes a UI instead of only photographing it.

The source is `../tho/app/test/guide_components_test.dart`, which renders each widget alone
on a transparent ground through `flutter test` — no emulator, no device, no window. Its own
header explains why that is the only Flutter runtime that can do this headlessly.

What this does, and why:

* **PNG -> WebP, keeping alpha.** These composite over the film's warm ground, so the
  transparency is the whole point; `libwebp` keeps it and costs about a fifth of the bytes.
  Lossy at 92 rather than lossless: they are photographic-ish card shadows, and lossless
  WebP on a soft shadow is larger than the PNG it replaces.

* **Sizes are generated, placement is not.** `lib/guide/components.ts` gets each component's
  intrinsic size in layout pixels; `lib/guide/floaters.ts` says which ones appear in which
  chapter. That split is deliberate and matches `hotspots.ts` against `guides.ts`: a
  re-capture resizes every component without touching a single authoring decision.

* **Captured at 3x, published at 1x.** The Dart side renders at `devicePixelRatio` 3 so the
  stage can scale a component and keep it crisp. The manifest divides back down, because the
  stage lays out in CSS pixels and should not have to know the capture ratio.

Usage:
    python scripts/import-app-components.py          # convert what changed
    python scripts/import-app-components.py --force  # reconvert everything
    python scripts/import-app-components.py --check  # report only, write nothing
"""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SOURCE = REPO.parent / "tho" / "app" / "docs" / "screenshots" / "components"
OUT = REPO / "public" / "guide" / "components"
MANIFEST = REPO / "lib" / "guide" / "components.ts"

# Must match `_pixelRatio` in the Dart harness.
CAPTURE_RATIO = 3

HEADER = """/**
 * Every captured UI component and the size it renders at.
 *
 * **Generated. Do not edit by hand** — `python scripts/import-app-components.py` rewrites
 * this whole file from `../tho/app/docs/screenshots/components/`, and anything typed here
 * is lost on the next run.
 *
 * Sizes are in CSS pixels: the Dart harness captures at 3x so the stage can scale a
 * component without softening it, and the importer divides back down so nothing downstream
 * has to know that.
 *
 * The split from `floaters.ts` is the point: this file is *measurement*, that one is
 * *choice*. A re-capture resizes every component here without touching a decision there.
 */
export type ComponentBox = { w: number; h: number };

export const COMPONENTS: Record<string, ComponentBox> = {
"""


def png_size(path: Path) -> tuple[int, int]:
    """Width and height from the IHDR chunk — no image library needed for 8 header bytes."""
    with path.open("rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")
    return struct.unpack(">II", head[16:24])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true", help="reconvert everything")
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    if not SOURCE.is_dir():
        sys.exit(
            f"no captures at {SOURCE}\n"
            "Run this first, from ../tho/app:\n"
            "  flutter test test/guide_components_test.dart"
        )

    sources = sorted(SOURCE.glob("*.png"))
    if not sources:
        sys.exit(f"{SOURCE} has no PNGs — did the capture run?")

    if not args.check:
        OUT.mkdir(parents=True, exist_ok=True)

    boxes: dict[str, tuple[int, int]] = {}
    converted = skipped = 0

    for src in sources:
        w, h = png_size(src)
        if w % CAPTURE_RATIO or h % CAPTURE_RATIO:
            # Not fatal: a half pixel here costs nothing visible. Worth saying out loud
            # though, because it means the harness and this script disagree about the ratio.
            print(f"  note: {src.name} is {w}x{h}, not a multiple of {CAPTURE_RATIO}")
        boxes[src.stem] = (round(w / CAPTURE_RATIO), round(h / CAPTURE_RATIO))

        dst = OUT / f"{src.stem}.webp"
        if args.check:
            continue
        if dst.exists() and not args.force and dst.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(src),
                # Alpha is the whole reason these exist; `-lossless 0` at 92 keeps the soft
                # card shadows clean without the size lossless costs on a gradient.
                "-c:v", "libwebp", "-lossless", "0", "-quality", "92",
                str(dst),
            ],
            check=True,
        )
        converted += 1

    # A component published earlier and no longer captured would otherwise linger, and
    # `floaters.ts` would keep pointing at it long after it stopped being real.
    stale = []
    if OUT.is_dir():
        stale = [p for p in OUT.glob("*.webp") if p.stem not in boxes]
    for p in stale:
        print(f"  stale: {p.name}")
        if not args.check:
            p.unlink()

    if not args.check:
        lines = [HEADER]
        for name, (w, h) in sorted(boxes.items()):
            lines.append(f'  "{name}": {{ w: {w}, h: {h} }},\n')
        lines.append("};\n")
        MANIFEST.write_text("".join(lines), encoding="utf-8")

    total = sum((OUT / f"{n}.webp").stat().st_size for n in boxes if (OUT / f"{n}.webp").exists())
    print(
        f"{len(boxes)} components"
        + (f" · {converted} converted, {skipped} unchanged" if not args.check else " (check only)")
        + (f", {len(stale)} stale removed" if stale else "")
        + (f" · {total / 1024:.0f} KB" if total else "")
    )
    if not args.check:
        print(f"  {OUT.relative_to(REPO)}")
        print(f"  {MANIFEST.relative_to(REPO)}")


if __name__ == "__main__":
    main()
