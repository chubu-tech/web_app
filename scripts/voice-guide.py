#!/usr/bin/env python3
"""Speak the walkthrough scripts, measure the result, and re-time the films to it.

## Where the words come from

Not from this file, and not from a second copy of the script: the narration is read out of
the running stage through `window.__stage.steps()`, exactly as `render-guide.py` does. That
is the whole reason this opens a browser to synthesise audio — the words that are spoken and
the words that are drawn have to come from one place, or a late edit to a line silently
leaves the voice saying something the screen no longer shows.

## Why the durations matter more than the audio

`stepHold` in `timeline.ts` holds a frame for `step.seconds ?? estimateSpeechSeconds(...)`.
Before this ran, every step was held for an *estimate* — 165 words a minute plus a breath per
sentence — which is generous on purpose, because a frame that outlives its sentence is a
pause and one that ends inside it is a mistake. Measuring the real clips replaces every guess
with the truth, so a step holds exactly as long as its sentence takes. Generous everywhere
added up to about a minute per film.

That is why this writes `lib/guide/durations.ts` and the films are re-rendered afterwards:
the audio changes the picture's timing, not just its soundtrack.

## Engines

    edge        Microsoft Edge's read-aloud voices, no account (default)
    piper       local, offline, no account
    elevenlabs  needs ELEVENLABS_API_KEY in .env.local

The default is `edge` with `en-GB-RyanNeural` because that is the voice that was chosen. It
is worth being clear in writing about what that costs: `edge` reaches a browser feature
through an unofficial client, and Microsoft licenses no redistribution of the audio it
returns. `public/guide/voice/LICENCE.md` records that position beside the audio rather than
leaving it implicit.

`piper` remains a switch away — `--engine piper --voice en_GB-cori-high` — and is the only
one of the three that is actually licensed for a commercial film. Nothing about the pipeline
changes with the engine: re-run, re-render, and the films are re-cut to the new durations.

Usage:
    python scripts/voice-guide.py                    # speak both, write durations
    python scripts/voice-guide.py --audience owner   # just one
    python scripts/voice-guide.py --check            # print the script, synthesise nothing
    python scripts/voice-guide.py --force            # re-speak lines that already exist
    python scripts/voice-guide.py --mux              # lay existing clips onto the films
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "public" / "guide" / "voice"
MANIFEST = REPO / "lib" / "guide" / "durations.ts"
VIDEO = REPO / ".guide-masters"

# Beside the render cache, and gitignored with it: a voice model is 110 MB and has no
# business in the repository when the script can fetch it on demand.
MODELS = REPO / ".next" / "cache" / "piper-voices"

DEFAULT_ENGINE = "edge"
DEFAULT_VOICE = {
    "edge": "en-GB-RyanNeural",
    "piper": "en_GB-cori-high",
    "elevenlabs": "EXAVITQu4vr4xnSDxMaL",
}

# Slightly under natural pace, for both engines. The viewer is watching a ring appear on a
# phone screen while the sentence explains it, so the line has to leave room for the eye to
# arrive. These are the settings the approved samples were generated with.
EDGE_RATE = "-4%"
PIPER_LENGTH_SCALE = 1.06


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


def clip_path(frame: str) -> Path:
    """Mirrors `public/guide/app/`, so a clip sits at the same path as the frame it speaks.

    No audience in the path: a frame already carries its own (`customer/06-discover`,
    `auth/01-onboarding`), and all 58 are unique across both guides — `guides.test.ts`
    holds that, which is what makes it safe to key the durations by frame alone.
    """
    return OUT / f"{frame}.mp3"


def trim_silence(path: Path) -> None:
    """Strip the dead air from both ends of a clip, in place.

    Applied to every engine's output rather than inside one of them, because it is a
    property the *pipeline* needs rather than a quirk of a particular voice: a clip's first
    sample has to be its first sound, or two things go wrong at once. The step holds for the
    clip's length, so leading silence pads the picture as well as the audio; and the mux lays
    the clip at its step's start, so the same silence pushes the voice late against the frame
    it is describing.

    Edge's read-aloud returns about 0.26s of it on every line, which measured as a 0.24s
    median lag across all 58 steps — small enough to sound like nothing in particular and
    large enough to be the difference between a cut that lands and one that drags.

    Idempotent: re-running on a trimmed clip finds no silence to remove.
    """
    trimmed = path.with_suffix(".trim.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-af",
         # Head, then the same filter again on a reversed stream for the tail. `-50dB`
         # rather than absolute zero because a lossy decode never returns exact silence.
         "silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB:detection=peak,"
         "areverse,"
         "silenceremove=start_periods=1:start_silence=0:start_threshold=-50dB:detection=peak,"
         "areverse",
         "-c:a", "libmp3lame", "-b:a", "128k", str(trimmed)],
        check=True,
    )
    trimmed.replace(path)


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return round(float(out), 3)


# ---- engines ---------------------------------------------------------------------------


class Edge:
    """Microsoft's read-aloud voices. No account, but no licence to redistribute either."""

    def __init__(self, voice: str):
        self.voice = voice

    def say(self, text: str, dest: Path) -> None:
        import edge_tts

        dest.parent.mkdir(parents=True, exist_ok=True)
        asyncio.run(edge_tts.Communicate(text, self.voice, rate=EDGE_RATE).save(str(dest)))


class Piper:
    """Local neural TTS. Loads the model once — it is 110 MB and 58 reloads is a minute."""

    def __init__(self, voice: str):
        from piper import PiperVoice, SynthesisConfig
        from piper.download_voices import download_voice

        MODELS.mkdir(parents=True, exist_ok=True)
        model = MODELS / f"{voice}.onnx"
        if not model.exists():
            print(f"fetching {voice} (about 110 MB, once)")
            download_voice(voice, MODELS)
        self.voice = PiperVoice.load(model)
        self.config = SynthesisConfig(
            length_scale=PIPER_LENGTH_SCALE, normalize_audio=True
        )

    def say(self, text: str, dest: Path) -> None:
        wav = dest.with_suffix(".wav")
        wav.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(wav), "wb") as handle:
            self.voice.synthesize_wav(text, handle, syn_config=self.config)
        # MP3 rather than the raw WAV: these are kept in the repository so the mix can be
        # rebuilt without re-synthesising, and 22kHz mono speech at 128k is transparent.
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
             "-c:a", "libmp3lame", "-b:a", "128k", str(dest)],
            check=True,
        )
        wav.unlink()


class ElevenLabs:
    """Free tier: 10,000 characters a month, no commercial rights, attribution required."""

    def __init__(self, voice: str):
        key = os.environ.get("ELEVENLABS_API_KEY") or self._from_env_file()
        if not key:
            sys.exit(
                "ELEVENLABS_API_KEY is not set.\n"
                "Put it in web/.env.local, or use an engine that needs no account:\n"
                "  python scripts/voice-guide.py --engine edge"
            )
        self.key, self.voice = key, voice

    @staticmethod
    def _from_env_file() -> str | None:
        env = REPO / ".env.local"
        if not env.exists():
            return None
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
        return None

    def say(self, text: str, dest: Path) -> None:
        import urllib.request

        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice}",
            data=json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
            headers={"xi-api-key": self.key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request) as response:
            dest.write_bytes(response.read())


ENGINES = {"edge": Edge, "piper": Piper, "elevenlabs": ElevenLabs}


# ---- the pass --------------------------------------------------------------------------


async def collect(audiences: list[str]) -> dict[str, list[dict]]:
    """The script, straight out of the stage the picture is drawn from."""
    from playwright.async_api import async_playwright

    rg = load_renderer()
    rg.bundle()
    script: dict[str, list[dict]] = {}
    with rg.Server() as server:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            page = await browser.new_page(viewport={"width": rg.WIDTH, "height": rg.HEIGHT})
            for audience in audiences:
                await rg.open_stage(page, server.port, audience)
                script[audience] = await page.evaluate("() => window.__stage.steps()")
            await browser.close()
    return script


def write_manifest(measured: dict[str, float], engine: str, voice: str) -> None:
    lines = [
        "/**\n",
        " * How long each narrated line actually takes, in seconds.\n",
        " *\n",
        " * **Generated. Do not edit by hand** — `python scripts/voice-guide.py` rewrites this\n",
        " * whole file from the audio in `public/guide/voice/`.\n",
        " *\n",
        " * `guides.ts` stamps these onto their steps as `seconds`, which `stepHold` prefers over\n",
        " * `estimateSpeechSeconds`. Every step therefore holds for as long as its sentence really\n",
        " * takes rather than as long as 165 words a minute predicted it would.\n",
        " *\n",
        " * Keyed by the frame alone: every frame is unique across both guides, which\n",
        " * `guides.test.ts` asserts, so a step can move between chapters without its timing\n",
        " * following the wrong screen.\n",
        " *\n",
        f" * Spoken by: {engine} / {voice}.\n",
        " */\n",
        "export const VOICE_SECONDS: Record<string, number> = {\n",
    ]
    for key in sorted(measured):
        lines.append(f'  "{key}": {measured[key]},\n')
    lines.append("};\n")
    MANIFEST.write_text("".join(lines), encoding="utf-8")


EDGE_LICENCE = """# Narration

Spoken by **{voice}** through Microsoft Edge's read-aloud service, generated with
[edge-tts](https://github.com/rany2/edge-tts).

## The licence position, stated plainly

This is the part that needs writing down rather than assuming.

`edge-tts` is an **unofficial** client for the text-to-speech behind Edge's Read Aloud
feature. Microsoft publishes no licence granting redistribution of that audio, and read-aloud
is offered as a browser accessibility feature rather than as a media-production service.
Putting it on a public marketing site is therefore **not covered by any licence granted to
us** — it is not a permissive licence with conditions attached, it is the absence of one.

This voice was chosen on how it sounds, with that understood.

## What the alternatives were

* **Piper — `en_GB-cori-high`** — a local, offline model whose card records it as public
  domain and trained from scratch. This is the only one of the three that is actually
  licensed for commercial use, and it needs no account and has no cap. Switching costs one
  command: `python scripts/voice-guide.py --engine piper --voice en_GB-cori-high --force`,
  then a re-render.
* **ElevenLabs free tier** — the best-sounding of the three, but grants no commercial rights
  and requires an on-screen `elevenlabs.io` credit.

## If this needs to change later

Nothing downstream is tied to the engine. `voice-guide.py` re-speaks every line, re-measures
it, and rewrites `lib/guide/durations.ts`; `render-guide.py` then re-cuts both films to the
new timings. No script is rewritten and no picture decision is revisited.
"""

PIPER_LICENCE = """# Narration

Spoken by [Piper](https://github.com/OHF-Voice/piper1-gpl) (MIT) with the **{voice}** voice,
generated on this machine. No account, no API, nothing sent anywhere.

## Why this voice and not a better-sounding one

Most Piper voices are finetuned from the U.S. English **lessac** model, whose training data
is the Lessac/Blizzard corpus — and that licence has to be applied for and granted to a named
person or organisation. A voice carrying those weights is not something to put on a
commercial marketing site on the strength of "it was free to download".

`{voice}` is one of the few that is neither: its model card records it as **public domain**
and **trained from scratch**, on a dataset the author assembled from LibriVox, whose
recordings are themselves public domain.

* Model card: <https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/cori/high>
* Engine licence: MIT

## What this means in practice

Commercial use is fine. No attribution is required, and none is claimed on screen. There is
no character budget, so a line can be rewritten and re-cut as often as it needs to be.
"""


def write_licence(engine: str, voice: str) -> None:
    """Record what was used and what it permits, next to the audio itself.

    Written for every engine, not just the comfortable one. A licence note that only appears
    when the answer is good is worse than none, because its absence then reads as an
    oversight rather than as the answer.
    """
    template = {"edge": EDGE_LICENCE, "piper": PIPER_LICENCE}.get(engine)
    if template is None:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "LICENCE.md").write_text(template.format(voice=voice), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audience", choices=("customer", "owner"), help="just one")
    ap.add_argument("--engine", choices=tuple(ENGINES), default=DEFAULT_ENGINE)
    ap.add_argument("--voice", help="engine-specific voice id")
    ap.add_argument("--check", action="store_true", help="print the script, speak nothing")
    ap.add_argument("--force", action="store_true", help="re-speak lines that already exist")
    ap.add_argument("--mux", action="store_true", help="lay existing clips onto the films")
    args = ap.parse_args()

    audiences = [args.audience] if args.audience else ["customer", "owner"]
    voice = args.voice or DEFAULT_VOICE[args.engine]
    script = asyncio.run(collect(audiences))

    if args.check:
        for audience in audiences:
            steps = script[audience]
            chars = sum(len(s["narration"]) for s in steps)
            print(f"\n{audience}: {len(steps)} lines, {chars:,} characters")
            for s in steps:
                print(f"  {len(s['narration']):4d}  {s['frame']}")
        total = sum(len(s["narration"]) for a in audiences for s in script[a])
        print(f"\ntotal: {total:,} characters")
        return

    if args.mux:
        for audience in audiences:
            mux(audience, script[audience])
        return

    engine = ENGINES[args.engine](voice)
    measured: dict[str, float] = {}
    if MANIFEST.exists() and not args.force:
        # Keep timings for anything not being re-spoken this run.
        for line in MANIFEST.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith('"'):
                key, value = line.strip().rstrip(",").split(":", 1)
                measured[key.strip().strip('"')] = float(value)

    for audience in audiences:
        spoken = 0
        for step in script[audience]:
            dest = clip_path(step["frame"])
            if args.force or not dest.exists():
                engine.say(step["narration"], dest)
                trim_silence(dest)
                spoken += 1
            measured[step["frame"]] = duration(dest)
        total = sum(measured[s["frame"]] for s in script[audience])
        mins, secs = int(total // 60), total % 60
        print(
            f"{audience}: {spoken} spoken, {len(script[audience])} lines, "
            f"{mins}m {secs:04.1f}s of speech"
        )

    write_manifest(measured, args.engine, voice)
    write_licence(args.engine, voice)
    print(f"  {MANIFEST.relative_to(REPO)}")
    print(f"  {OUT.relative_to(REPO)}")
    print("\nNow re-render, so the picture holds to the real durations:")
    print("  python scripts/render-guide.py")


def mux(audience: str, steps: list[dict]) -> None:
    """Lay each clip at its step's start on the silent film.

    Built from the *timeline's* step starts rather than by concatenating clips end to end:
    a step's hold is the clip plus a tail, so concatenation would drift a little later with
    every step and be seconds out by the end of a five-minute film.
    """
    film = VIDEO / f"{audience}-picture.mp4"
    if not film.exists():
        sys.exit(f"no film at {film} — run render-guide.py first")

    clips = [(s["start"], clip_path(s["frame"])) for s in steps]
    missing = [p for _, p in clips if not p.exists()]
    if missing:
        sys.exit(f"{len(missing)} clips missing, first: {missing[0]}")

    inputs: list[str] = []
    for _, path in clips:
        inputs += ["-i", str(path)]
    # `all=1` rather than a per-channel delay list: these clips are mono, and a two-value
    # list silently applies the second delay to a channel that is not there.
    delays = "".join(
        f"[{i + 1}:a]adelay=all=1:delays={int(start * 1000)}[a{i}];"
        for i, (start, _) in enumerate(clips)
    )
    mixed = "".join(f"[a{i}]" for i in range(len(clips)))
    # `amix` would divide every voice by the number of inputs; the clips never overlap, so
    # `normalize=0` keeps each line at its own level. `loudnorm` then sets a broadcast
    # standard level with a true-peak ceiling, so the music mix in the next phase starts
    # from a known number rather than from whatever the loudest line happened to be — and
    # so nothing clips when a bed is summed underneath.
    graph = (
        f"{delays}{mixed}amix=inputs={len(clips)}:normalize=0,"
        "loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    )

    dest = VIDEO / f"{audience}-voiced.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(film), *inputs,
         "-filter_complex", graph, "-map", "0:v", "-map", "[out]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
         "-shortest", str(dest)],
        check=True,
    )
    size = dest.stat().st_size / 1e6
    print(f"{audience}: {dest.relative_to(REPO)}  {size:.1f} MB")


if __name__ == "__main__":
    main()
