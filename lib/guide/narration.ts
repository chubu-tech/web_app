/**
 * The pure half of the guide's narration: which voice to speak with, how fast,
 * and how long a line will take.
 *
 * Everything that only exists in a browser — the utterance, its lifecycle, and
 * the four ways `speechSynthesis` misbehaves — lives in
 * `components/guide/use-narration.ts`. This module is arithmetic and ranking, so
 * it is testable without a DOM and it lives in `lib/` where a server component
 * could import it if one ever needed the run time.
 *
 * ## Why a recorded voice slots in without touching any of this
 *
 * `estimateSpeechSeconds` is only consulted when the synthesiser cannot tell us
 * when it finished. A recorded clip reports its own duration and its own `ended`,
 * so a step carrying `audio` never reaches this file. That is the drop-in point
 * for ElevenLabs: fill in the clip and the estimate stops being used, with no
 * change to the player's timing contract.
 */

/**
 * Speech rate, as `SpeechSynthesisUtterance.rate`.
 *
 * Slightly under 1 because the default is pitched at *reading a document*, and a
 * walkthrough is being watched as well as heard — the viewer is looking at a
 * ring appearing on a phone screen while the sentence explains it. Below about
 * 0.85 the browser voices start to sound drugged, so this is as slow as it is
 * worth going.
 */
export const NARRATION_RATE = 0.95;

/**
 * Words per minute at `rate: 1`.
 *
 * Measured against the browser voices rather than taken from a typical *human*
 * speaking rate, which is nearer 130 and would over-estimate every line by a
 * fifth. The estimate only has to be good enough to be a **backstop** — the
 * voice's own `end` event is what normally advances a step — so being slightly
 * generous is the safe direction: a frame that holds a moment too long is a
 * pause, and one that cuts early truncates a sentence.
 */
const WORDS_PER_MINUTE = 165;

/** A breath at a sentence end, in seconds. Browsers insert one; the maths has to too. */
const SENTENCE_PAUSE = 0.35;

/** Nothing is ever allowed to be instantaneous — a 2-word line still needs reading time. */
const MINIMUM_SECONDS = 1.6;

/**
 * How long [text] will take to speak at [rate].
 *
 * Words, not characters: a character count makes "Bhutan" and "queue" cost what
 * their spelling costs rather than what saying them costs, and this copy has a
 * lot of short proper nouns.
 */
export function estimateSpeechSeconds(text: string, rate: number = NARRATION_RATE): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;

  const sentences = (text.match(/[.!?]+/g) ?? []).length;
  const spoken = (words / WORDS_PER_MINUTE) * 60;
  const total = (spoken + sentences * SENTENCE_PAUSE) / (rate || 1);
  return Math.max(MINIMUM_SECONDS, Math.round(total * 10) / 10);
}

/**
 * Voices that are jokes, and would turn the guide into one.
 *
 * macOS ships two dozen novelty voices and they are ordinary members of
 * `getVoices()` — "Bad News" reads your booking confirmation as a funeral dirge,
 * "Bubbles" gargles it. A ranking that only looked at locale would pick one of
 * these on a Mac whenever it happened to sort first, so they are excluded before
 * anything else is considered.
 */
const NOVELTY = new Set([
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos",
  "deranged", "good news", "jester", "junior", "kathy", "organ", "superstar",
  "trinoids", "whisper", "wobble", "zarvox",
]);

/**
 * Locale preference, best first.
 *
 * `en-IN` above `en-GB` is deliberate and is the one entry here that is a product
 * decision rather than a technical one: this is a Bhutanese product, and South
 * Asian English is the accent its customers actually hear. `en-GB` follows
 * because Bhutanese written English is British-spelled, which is what the rest of
 * this copy is written in. `en-US` is last of the named ones purely because it is
 * the least like either.
 */
const LOCALE_RANK = ["en-in", "en-gb", "en-au", "en-nz", "en-za", "en-us"];

/**
 * Voice names that signal a modern neural voice rather than a 1990s formant one.
 *
 * The difference is enormous and it is not exposed in the API — there is no
 * "quality" field — so the name is the only signal available. Every one of these
 * is a vendor's own marketing word for their better engine.
 */
const PREMIUM = ["natural", "neural", "enhanced", "premium", "google", "siri"];

function score(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase().replace("_", "-");

  let points = 0;
  if (PREMIUM.some((word) => name.includes(word))) points += 100;

  const localeIndex = LOCALE_RANK.indexOf(lang);
  if (localeIndex >= 0) {
    points += 50 - localeIndex * 5;
  } else if (lang.startsWith("en")) {
    // An English voice from an unlisted region still beats a non-English one.
    points += 10;
  }

  // A local voice cannot fail halfway through because the network did.
  if (voice.localService) points += 5;
  // The platform's own default is a reasonable tiebreak, not a reason on its own.
  if (voice.default) points += 2;

  return points;
}

/**
 * Choose a voice, or `null` when there is nothing worth speaking with.
 *
 * **`null` is a real answer, not a failure to decide.** A browser can expose the
 * whole speech API and have no voices at all — a bare Linux box, a container, a
 * headless run — and in that state `speak()` reports `end` immediately. A guide
 * driven by that would flash through every step in as many seconds, so the caller
 * treats an empty list as *narration unsupported*, hides the toggle, and falls
 * back to each step's own duration.
 *
 * Non-English voices are refused rather than ranked last: the copy is English,
 * and a Spanish engine reading it is worse than no narration.
 */
export function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const usable = voices.filter((voice) => {
    const name = voice.name.toLowerCase();
    if (NOVELTY.has(name)) return false;
    return voice.lang.toLowerCase().startsWith("en");
  });
  if (usable.length === 0) return null;

  // A stable sort, so two equally-scored voices always resolve the same way
  // rather than depending on the platform's enumeration order.
  return usable
    .map((voice, index) => ({ voice, index, points: score(voice) }))
    .sort((a, b) => b.points - a.points || a.index - b.index)[0]!.voice;
}
