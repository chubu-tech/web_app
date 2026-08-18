/**
 * The guide's voiceover, in the parts that can be reasoned about without a browser.
 *
 * ## It is the browser's own voice, and that is a deliberate trade
 *
 * The narration is spoken by `speechSynthesis` — the Web Speech API — rather than by
 * shipping recorded audio. Three reasons, in order of weight:
 *
 * 1. **It cannot go stale.** The script lives beside the copy in `steps.ts`, so correcting a
 *    sentence corrects what is said. Thirty-two recorded clips would drift from the captions
 *    the first time anybody edited one, and a voiceover describing a screen that changed is
 *    worse than none.
 * 2. **It costs nothing to download.** Recorded narration for both guides is several
 *    megabytes on a connection this product is explicitly built for — see the map page's
 *    note about tile hosting.
 * 3. **It speaks every language the reader's device does.** A recording is one voice in one
 *    accent for ever.
 *
 * What it gives up is control of the timbre. On Edge and recent Chrome the "Natural" neural
 * voices are genuinely broadcast-quality; on an old Android the default voice is not. The
 * ranking below is what tries to land on the good one.
 *
 * **If studio narration is ever recorded, nothing here has to be rewritten**: `GuideStep`
 * takes an optional `audio` URL, and `use-narration.ts` plays that instead when it is
 * present. The two are the same feature with a different source.
 */

/**
 * A voice, reduced to what the ranking actually reads.
 *
 * `SpeechSynthesisVoice` is a DOM type, and this module is tested in node — where it does
 * not exist. Taking the three fields that matter keeps `pickVoice` a pure function over
 * plain objects, which is the only reason it can have tests at all.
 */
export type VoiceLike = {
  name: string;
  lang: string;
  localService: boolean;
};

/**
 * How fast the narration is read. Slightly under 1 on purpose: the default rate reads as
 * hurried on a guide somebody is watching for the first time, and this copy carries a fair
 * number of proper nouns ("Norzin", "Thimphu", "ngultrum") that a fraction more time makes
 * intelligible.
 */
export const NARRATION_RATE = 0.97;

/**
 * Words a second, for estimating how long a frame needs to hold.
 *
 * 2.6 is a measured read-aloud pace for explanatory prose at `NARRATION_RATE` — slower than
 * conversation (about 3.3) because narration lands better with pauses in it. It is only an
 * estimate: what actually advances a narrated frame is the utterance's own `end` event. This
 * number exists to give the progress bar a duration and to size the safety timer.
 */
export const WORDS_PER_SECOND = 2.6;

/**
 * How long this text will take to say, in seconds.
 *
 * The floor matters more than the arithmetic: a two-word frame should still be readable, and
 * a bar that fills in under three seconds reads as a glitch rather than as progress.
 */
export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 3;
  // The constant is the lead-in and the beat at the end, both of which every utterance has
  // and neither of which is a word.
  return Math.max(3, words / WORDS_PER_SECOND + 0.9);
}

/**
 * The best available voice for this copy, or `null` to let the browser choose.
 *
 * Ranked rather than matched, because the set of installed voices is different on every
 * machine and a first-match rule falls off the end into whatever is at index 0 — which on
 * Windows is as likely to be a Czech voice as an English one.
 *
 * The ordering, and why:
 *
 * - **"Natural" first.** That word in a voice name is Microsoft's and Google's marker for
 *   the neural voices, and the gap between those and the old concatenative ones is the whole
 *   difference between "professional narration" and "a satnav".
 * - **British English above American.** Not a preference: this product's copy is written in
 *   British English throughout — colour, utilisation, personalised — and the Ngultrum, Paro
 *   and Thimphu that fill it are pronounced closer to the mark by en-GB and en-IN voices.
 * - **Indian English above American**, for the same reason and one more: it is the English
 *   most familiar to the audience this app is built for.
 * - **eSpeak last.** It is the fallback on minimal Linux installs and it is unmistakably
 *   robotic; better to keep looking.
 * - **A non-English voice is never chosen.** Returning `null` hands the decision back to the
 *   browser, which will use the user's own default — a better guess than any this can make.
 */
export function pickVoice(voices: VoiceLike[]): VoiceLike | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  const score = (voice: VoiceLike): number => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let total = 0;
    if (name.includes("natural")) total += 100;
    if (name.startsWith("google")) total += 60;
    if (name.includes("espeak")) total -= 80;
    if (lang.startsWith("en-gb")) total += 30;
    else if (lang.startsWith("en-in")) total += 22;
    else if (lang.startsWith("en-au")) total += 12;
    else if (lang.startsWith("en-us")) total += 10;
    // A cloud voice is usually the better one where both exist, but only as a tie-break —
    // an offline device must still get a voice rather than silence.
    if (!voice.localService) total += 8;
    return total;
  };

  // `reduce` rather than `sort`: a sort would reorder the caller's array, and the ordering
  // `speechSynthesis.getVoices()` returns is the platform's own preference, which is exactly
  // what should break a tie between two voices this cannot tell apart.
  return english.reduce((best, voice) => (score(voice) > score(best) ? voice : best));
}
