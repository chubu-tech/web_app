"""Write the films' caption tracks.

A narrated video with no captions fails WCAG 1.2.2, and it fails it for the people the
narration was the accessibility answer *for*. Nothing here is transcription, though: the
words and their timings already exist, in the two places that also produced the voice.

    guides.ts  ──► the stage ──► narration, and where each step starts
    durations.ts ─────────────►  how long each line actually takes to say

So the captions cannot drift from the audio the way a hand-written transcript would. Edit a
line of narration and this rewrites itself from the same source the voice was read from.

## Where the timings come from, and where they stop being exact

A step's start is exact. A line's *length* is measured — `durations.ts` holds the real
duration of every one of the 58 clips, so a cue ends when the speaking does rather than when
the picture cuts, which on a step with a tail can be a second and a half later.

Within a line it is an estimate. A cue holding eight seconds of speech is unreadable, so long
narration is split at sentence and clause boundaries and the measured time is shared out by
character count. That assumes an even speaking rate, which is close enough over a sentence
and would not be over a word. Word-level timings would need a forced aligner; the error here
is a fraction of a second on a cue that is on screen for four of them.

Usage:
    python scripts/captions-guide.py

Output:
    public/guide/video/<audience>.vtt
"""

from __future__ import annotations

import asyncio
import importlib.util
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "guide" / "video"
MANIFEST = REPO / "lib" / "guide" / "durations.ts"

AUDIENCES = ("customer", "owner")

# A caption line people can read at a glance. Two of them is the ceiling everywhere that
# publishes a house style, and the width is about what fits a phone held upright.
LINE = 42
CUE = LINE * 2

# Where a sentence may be broken when it will not fit - whichever falls latest inside
# the box wins. Each mark stays with the clause it closes.
MARKS = (", ", "; ", " — ", " - ")

# Captions that vanish on the last syllable read as clipped, so each holds a beat longer -
# but never into the next cue, and never past the step it belongs to.
LINGER = 0.4


def load_renderer():
    """Borrow the renderer's bundle/serve/open helpers rather than keeping a second copy.

    `spec_from_file_location` because the filename has a hyphen and cannot be imported.
    """
    spec = importlib.util.spec_from_file_location(
        "render_guide", REPO / "scripts" / "render-guide.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def measured() -> dict[str, float]:
    """The spoken length of every clip, from the generated manifest."""
    text = MANIFEST.read_text(encoding="utf-8")
    return {k: float(v) for k, v in re.findall(r'"([^"]+)":\s*([\d.]+)', text)}


def split(text: str) -> list[str]:
    """Break a line of narration into pieces that fit two caption lines.

    Sentences first, because a cue that ends mid-sentence is the thing that makes captions
    tiring to read. Only a sentence too long for the box is broken further, at a clause
    boundary if it has one and between words if it does not.
    """
    pieces: list[str] = []
    for sentence in re.findall(r"[^.!?]+[.!?]*\s*", text):
        sentence = sentence.strip()
        while len(sentence) > CUE:
            # The latest clause boundary inside the box, so the first piece is as full as it
            # can be - and the cut lands *after* the mark, because punctuation belongs to the
            # clause it closes. Cutting before it opened the next caption on a stray em dash.
            cut = -1
            for mark in MARKS:
                pos = sentence.rfind(mark, 0, CUE)
                if pos > 0:
                    cut = max(cut, pos + len(mark) - 1)
            if cut <= 0:
                cut = sentence.rfind(" ", 0, CUE)
            if cut <= 0:
                break
            pieces.append(sentence[: cut + 1].strip())
            sentence = sentence[cut + 1 :].strip()
        if sentence:
            pieces.append(sentence)
    return pieces or [text.strip()]


def wrap(text: str) -> str:
    """Two lines at most, balanced, so neither is a single word above a full one."""
    if len(text) <= LINE:
        return text
    words = text.split()
    best: int | None = None
    score: tuple[bool, int] | None = None
    for i in range(1, len(words)):
        left = len(" ".join(words[:i]))
        right = len(" ".join(words[i:]))
        # A split where both lines fit beats one where either does not; among equals, the
        # most even. Every position is scanned rather than stopping at the first improvement:
        # the version this replaces broke out on its second step, which orphaned the opening
        # word of every caption longer than one line.
        candidate = (max(left, right) > LINE, abs(left - right))
        if score is None or candidate < score:
            best, score = i, candidate
    assert best is not None
    return " ".join(words[:best]) + "\n" + " ".join(words[best:])


def stamp(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def cues(steps: list[dict], spoken: dict[str, float], duration: float) -> list[tuple[float, float, str]]:
    out: list[tuple[float, float, str]] = []
    for i, step in enumerate(steps):
        narration = (step.get("narration") or "").strip()
        if not narration:
            continue
        next_start = steps[i + 1]["start"] if i + 1 < len(steps) else duration
        # The measured clip, not the step's hold: a step keeps the picture up through its
        # tail, and a caption sitting there after the voice has stopped reads as a stall.
        length = spoken.get(step["frame"], next_start - step["start"])

        pieces = split(narration)
        total = sum(len(p) for p in pieces) or 1
        t = step["start"]
        for j, piece in enumerate(pieces):
            share = length * len(piece) / total
            end = t + share + (LINGER if j == len(pieces) - 1 else 0.0)
            out.append((t, min(end, next_start), wrap(piece)))
            t += share
    return out


def write(audience: str, entries: list[tuple[float, float, str]]) -> Path:
    body = ["WEBVTT", "", f"NOTE Generated by scripts/captions-guide.py - do not edit by hand.", ""]
    for i, (start, end, text) in enumerate(entries, 1):
        body += [str(i), f"{stamp(start)} --> {stamp(end)}", text, ""]
    dest = OUT / f"{audience}.vtt"
    dest.write_text("\n".join(body), encoding="utf-8", newline="\n")
    return dest


async def main() -> None:
    from playwright.async_api import async_playwright

    spoken = measured()
    rg = load_renderer()
    rg.bundle()
    with rg.Server() as server:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(viewport={"width": rg.WIDTH, "height": rg.HEIGHT})
            for audience in AUDIENCES:
                await rg.open_stage(page, server.port, audience)
                steps = await page.evaluate("() => window.__stage.steps()")
                duration = await page.evaluate("() => window.__stage.duration()")
                entries = cues(steps, spoken, duration)
                dest = write(audience, entries)
                longest = max(e - s for s, e, _ in entries)
                print(f"{audience}: {len(entries)} cues from {len(steps)} steps, "
                      f"longest {longest:.1f}s  ->  {dest.relative_to(REPO)}")
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
