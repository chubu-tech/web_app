"""Lay a music bed under the narrated films.

Phase E. Reads `public/guide/music/bed.mp3`, and for each audience takes the voiced film,
puts the bed under it, and writes `{audience}-final.mp4` — the file the site serves.

## The picture is never re-encoded

`-c:v copy`. Everything Phase C decided about the picture survives this step untouched, which
is why the render and the mix can be reasoned about separately: a music change costs a minute,
not a twenty-minute encode.

## The bed is gain-matched, not "turned down a bit"

A fixed `-18 dB` fader is meaningless without knowing what it is applied to — the six CC0
candidates auditioned for this ranged over 9 LUFS, so the same fader would have put one bed
twice as loud as another. Each bed is measured and moved to `BED_LUFS`, so the level is a
property of the mix rather than of whichever file happened to be dropped in.

## Ducking is the chapter-aligned level change

The plan called for the bed to lift and settle at chapter boundaries. That is what a
sidechain compressor keyed off the narration already does, and it does it from the audio
rather than from a second copy of the timeline that could drift out of step: the voice stops
at a chapter end, the bed comes up over the card, the next line pushes it back down. Adding a
scripted automation curve on top would be a second opinion about the same moment.
"""

import argparse
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
# The two intermediates are derived and never served; only the finished film is.
MASTERS = REPO / ".guide-masters"
VIDEO = REPO / "public" / "guide" / "video"
BED = REPO / "public" / "guide" / "music" / "bed.mp3"

# Under a -16 LUFS narration this reads as present but plainly behind. Raising it a couple of
# dB is the single most tempting and most damaging edit available here.
BED_LUFS = -30.0
FADE_IN = 1.5
FADE_OUT = 2.0

# How hard the voice pushes the bed down. 8:1 above a low threshold is a duck rather than a
# compression: near-inaudible while speaking, fully back within half a second of a line ending.
DUCK = "threshold=0.03:ratio=8:attack=20:release=400"

# Broadcast level for the finished mix. The true-peak ceiling is set 0.5 dB below where we
# want to land, because `loudnorm` limits the PCM it is handed and the AAC encoder that comes
# after it overshoots: asking for -1.5 measured -0.9 on the decoded file. -2.0 lands at -1.7.
FINAL = "I=-16:TP=-2.0:LRA=11"

# Both branches are pinned to this before they meet.
#
# The narration is 24 kHz mono, and Phase D's mux left the voiced films 96 kHz mono - four
# times the rate of the material, carrying nothing. Left alone, `amix` resolves a mono voice
# against a stereo bed by taking the narrower layout, which folds the music to mono. That is
# audible: a bed reads as behind the voice partly because it is wider than the voice, and a
# centre-panned bed competes with a centre-panned narrator for the same space.
#
# So the voice is widened to stereo - a mono source in both channels, which is a centred
# image and exactly right for narration - and the bed keeps the width it was written with.
# 48 kHz is the standard rate for video and comfortably above anything either branch holds.
FORMAT = "aformat=channel_layouts=stereo:sample_rates=48000"


def run(cmd: list[str]) -> str:
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        sys.exit(f"failed: {' '.join(cmd[:6])}...\n{p.stderr[-2000:]}")
    return p.stderr


def duration(path: pathlib.Path) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout)


def lufs(path: pathlib.Path) -> float:
    out = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", "ebur128=framelog=quiet", "-f", "null", "-"])
    return float(re.search(r"I:\s+([-\d.]+) LUFS", out).group(1))


def loudness(path: pathlib.Path) -> tuple[float, float]:
    out = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"])
    return (float(re.search(r"I:\s+([-\d.]+) LUFS", out).group(1)),
            float(re.search(r"Peak:\s+([-\d.]+) dBFS", out).group(1)))


def score(audience: str, gain: float, crossfade: float) -> pathlib.Path:
    film = MASTERS / f"{audience}-voiced.mp4"
    dest = VIDEO / f"{audience}.mp4"
    length = duration(film)

    # `aloop` butt-joins, which is right for a bed that was written as a loop and wrong for one
    # that fades out at the end. `--crossfade` covers the second case.
    if crossfade > 0:
        reps = int(length // (duration(BED) - crossfade)) + 1
        inputs = "".join(f"[1:a]atrim=0:{duration(BED)},asetpts=N/SR/TB[b{i}];" for i in range(reps))
        chain = "[b0]"
        for i in range(1, reps):
            chain += f"[b{i}]acrossfade=d={crossfade}:c1=tri:c2=tri" + (f"[x{i}];[x{i}]" if i < reps - 1 else "")
        loop = f"{inputs}{chain}"
    else:
        loop = "[1:a]aloop=loop=-1:size=2e9,"

    graph = (
        f"{loop}atrim=0:{length},asetpts=N/SR/TB,volume={gain:.2f}dB,"
        f"afade=t=in:st=0:d={FADE_IN},afade=t=out:st={length - FADE_OUT:.3f}:d={FADE_OUT},"
        f"{FORMAT}[bed];"
        f"[0:a]{FORMAT},asplit=2[voice][key];"
        f"[bed][key]sidechaincompress={DUCK}[duck];"
        f"[voice][duck]amix=inputs=2:normalize=0,loudnorm={FINAL}[out]"
    )
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(film), "-i", str(BED),
         "-filter_complex", graph, "-map", "0:v", "-map", "[out]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
         "-movflags", "+faststart", "-shortest", str(dest)])
    return dest


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--audience", choices=["customer", "owner"], action="append")
    ap.add_argument("--crossfade", type=float, default=0.0,
                    help="seconds of crossfade at each loop join; 0 for a bed that loops cleanly")
    args = ap.parse_args()

    if not BED.exists():
        sys.exit(f"no bed at {BED} — Phase E picks one first")

    bed_lufs = lufs(BED)
    gain = BED_LUFS - bed_lufs
    print(f"bed: {BED.name}  {duration(BED):.1f}s  {bed_lufs:.1f} LUFS  ->  {gain:+.1f} dB")

    for audience in args.audience or ["customer", "owner"]:
        dest = score(audience, gain, args.crossfade)
        secs = duration(dest)
        I, peak = loudness(dest)
        print(f"{audience}: {int(secs // 60)}m {secs % 60:04.1f}s  "
              f"{dest.stat().st_size / 1024 / 1024:.1f} MiB  {I:.1f} LUFS  peak {peak:.1f} dBFS")


if __name__ == "__main__":
    main()
