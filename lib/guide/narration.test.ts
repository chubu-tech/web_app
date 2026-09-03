import { describe, expect, it } from "vitest";
import { NARRATION_RATE, estimateSpeechSeconds, pickVoice } from "./narration";

/** A `SpeechSynthesisVoice` is an interface; the tests only need these five fields. */
function voice(
  name: string,
  lang: string,
  extra: { localService?: boolean; default?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService: extra.localService ?? true,
    default: extra.default ?? false,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

describe("estimateSpeechSeconds", () => {
  it("is zero for nothing to say", () => {
    expect(estimateSpeechSeconds("")).toBe(0);
    expect(estimateSpeechSeconds("   ")).toBe(0);
  });

  it("never returns less than the minimum, however short the line", () => {
    expect(estimateSpeechSeconds("Tap Book.")).toBeGreaterThanOrEqual(1.6);
  });

  it("grows with the number of words", () => {
    const short = estimateSpeechSeconds("Choose a service.");
    const long = estimateSpeechSeconds(
      "Choose a service, then pick the stylist you want and the time that suits you.",
    );
    expect(long).toBeGreaterThan(short);
  });

  it("counts words, not characters", () => {
    // Same word count, very different character count. Within a breath of each
    // other, because saying them takes about the same time.
    const a = estimateSpeechSeconds("Book a haircut in Bhutan today please now");
    const b = estimateSpeechSeconds("Reschedule appointments internationally whenever circumstances unexpectedly change again");
    expect(Math.abs(a - b)).toBeLessThanOrEqual(SENTENCE_ALLOWANCE);
  });

  it("adds a breath per sentence", () => {
    const one = estimateSpeechSeconds("Pick a time and confirm it now");
    const two = estimateSpeechSeconds("Pick a time. And confirm it now.");
    expect(two).toBeGreaterThan(one);
  });

  it("takes longer at a slower rate", () => {
    const text = "Your booking is confirmed and the salon has been told.";
    expect(estimateSpeechSeconds(text, 0.8)).toBeGreaterThan(
      estimateSpeechSeconds(text, 1.2),
    );
  });

  it("treats a zero rate as 1 rather than dividing by it", () => {
    expect(Number.isFinite(estimateSpeechSeconds("A line of narration", 0))).toBe(true);
  });

  it("defaults to the guide's own rate", () => {
    const text = "Tap Book to choose a time.";
    expect(estimateSpeechSeconds(text)).toBe(estimateSpeechSeconds(text, NARRATION_RATE));
  });
});

/** One sentence's breath, the tolerance the character-count test allows. */
const SENTENCE_ALLOWANCE = 0.5;

describe("pickVoice", () => {
  it("returns null when there are no voices — the state that must disable narration", () => {
    expect(pickVoice([])).toBeNull();
  });

  it("returns null when nothing English is installed", () => {
    expect(pickVoice([voice("Mónica", "es-ES"), voice("Amélie", "fr-FR")])).toBeNull();
  });

  it("never picks a novelty voice, even as the only English one alongside a foreign voice", () => {
    expect(pickVoice([voice("Bad News", "en-US"), voice("Mónica", "es-ES")])).toBeNull();
  });

  it("prefers a neural voice over a plain one in a better locale", () => {
    const chosen = pickVoice([
      voice("Daniel", "en-GB"),
      voice("Microsoft Ryan Neural", "en-US"),
    ]);
    expect(chosen?.name).toBe("Microsoft Ryan Neural");
  });

  it("prefers Indian English over British when neither is neural", () => {
    const chosen = pickVoice([voice("Daniel", "en-GB"), voice("Rishi", "en-IN")]);
    expect(chosen?.name).toBe("Rishi");
  });

  it("prefers a listed locale over an unlisted English one", () => {
    const chosen = pickVoice([voice("Someone", "en-PH"), voice("Daniel", "en-GB")]);
    expect(chosen?.name).toBe("Daniel");
  });

  it("still picks an unlisted English voice when it is all there is", () => {
    expect(pickVoice([voice("Someone", "en-PH")])?.name).toBe("Someone");
  });

  it("breaks a tie by enumeration order, so the choice is stable", () => {
    const chosen = pickVoice([voice("First", "en-GB"), voice("Second", "en-GB")]);
    expect(chosen?.name).toBe("First");
  });

  it("accepts an underscore locale, which some engines report", () => {
    const chosen = pickVoice([voice("Zira", "en_US"), voice("Nobody", "de-DE")]);
    expect(chosen?.name).toBe("Zira");
  });
});
