# Narration

Spoken by **en-GB-RyanNeural** through Microsoft Edge's read-aloud service, generated with
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
