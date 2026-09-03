# The music bed

`bed.mp3` is **"Funky Energy Loop" by Kevin MacLeod**, released under the
**CC0 1.0 Universal Public Domain Dedication**.

| | |
|---|---|
| Title | Funky Energy Loop |
| Composer | Kevin MacLeod |
| Published by | FreePD.com, 2018 |
| Licence | [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode) |
| Fetched | 2026-09-03, from the Internet Archive's copy of FreePD.com |
| Source URL | `https://web.archive.org/web/2023id_/https://freepd.com/music/Funky%20Energy%20Loop.mp3` |
| Licence page | <https://web.archive.org/web/20230705195856/https://freepd.com/legal.php> |
| Catalogue page | <https://web.archive.org/web/20230705195856/https://freepd.com/scoring.php> |
| SHA-256 | `b7990b4287cc345b2f42af743c96e26e126b2b03adfad661961a28640fb94c55` |
| File | 202.5 s · 320 kbps · 44.1 kHz stereo · 8,102,178 bytes |

## What CC0 gives us

Everything we need, with no conditions. FreePD's own FAQ answers *Yes* to commercial use,
to use in an advertisement, to use in a film and to bundling inside software, and answers
"Nope — but we do like it" to whether the composer must be credited.

That is a materially better position than the narration in `../voice/LICENCE.md`, which is
produced by an unofficial client for a service that grants us nothing. This asset is clean.

We credit Kevin MacLeod anyway. It costs nothing and it is how the public domain keeps being
supplied.

## Why an archived copy is still public domain

FreePD.com closed in 2025 after seventeen years. Its final page reads: *"[freepd.com] is now
permanently closed."*

That does not touch the licence. CC0 is a dedication, not a subscription — the site's own FAQ
put it plainly: *"Can I buy exclusive rights to any of these tracks? No. The CC0 licensing is a
one-way trip."* A dedication already made cannot be withdrawn by the dedicator, still less by
their hosting lapsing. The rights we have in this file were fixed when it was published in
2018 and are unaffected by the site going dark.

The one thing that *does* go dark is the evidence, which is why this file records the archived
URLs, the date of the fetch and the checksum rather than pointing at a live page that no
longer exists.

## Three independent things say the same

Provenance is worth more than a licence label, because a label is one line of text somebody
typed. Here it is corroborated:

1. **The site said so.** FreePD's footer linked directly to the CC0 legal code, and its legal
   page is unusually candid about what a public-domain claim can and cannot mean — including
   the caveat that the music is *"copyright free to the extent that the law allows"*, which is
   precisely how CC0 works and not what someone overclaiming would write.
2. **The file says so.** `bed.mp3` carries its own ID3 tags: artist *Kevin MacLeod*, album
   *FreePD Music*, comment *source: freepd.com*, date *2018*. That travelled with the audio and
   did not come from the page we read.
3. **The composer is real and consistent.** Kevin MacLeod has published production music for
   two decades, and FreePD was his CC0 outlet — a deliberate second channel alongside the
   CC BY catalogue at incompetech.com.

## Two sources rejected on the way here

Both looked like CC0 and neither was, which is the reason this file exists.

- **Internet Archive's *Calm Pills*.** Marked CC0 1.0, 82 albums of exactly the right kind of
  music. It is a curator's compilation of *other artists'* work. Nobody can dedicate someone
  else's copyright to the public domain, so the mark on the compilation clears nothing about
  the tracks inside it.
- **The archive.org item `freepd`.** 1,025 MP3s, no licence metadata, uploaded anonymously
  from a throwaway address, with a BBC Earth track sitting among them. A scrape, not a
  release.

The lesson generalises: a CC0 label tells you what an uploader asserted, not what they were
entitled to assert. What matters is whether the person who applied it held the rights.

## Dual licensing, and where it could matter

Kevin MacLeod also publishes at incompetech.com under CC BY 4.0, which requires attribution.
Both are his to grant and neither limits the other — the CC0 dedication on this file stands
on its own.

It is worth knowing for one reason only. Automated Content ID systems match audio, not
licences, and a catalogue that exists under two licences occasionally gets flagged on
platforms like YouTube. We self-host these films on our own site, so it does not arise. It
would arise if they were ever reposted to a platform that scans uploads, and the answer then
is this file.

## Replacing it

Drop a different file at `bed.mp3`, update this record, and run:

```bash
python scripts/music-guide.py
```

About a minute per film. `--crossfade 2` is there for a bed that fades out at the end rather
than looping cleanly; this one rejoins itself within 0.7 dB and does not need it. The picture
is copied, never re-encoded, so no rendering decision is revisited by a change of music.
