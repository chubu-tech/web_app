import { describe, expect, it } from "vitest";
import { estimateSpeechSeconds, pickVoice, type VoiceLike } from "./narration";

const voice = (name: string, lang: string, localService = true): VoiceLike => ({
  name,
  lang,
  localService,
});

describe("estimateSpeechSeconds", () => {
  it("scales with the number of words", () => {
    const short = estimateSpeechSeconds("Start on Discover.");
    const long = estimateSpeechSeconds(
      "Everything open near you, ranked. Switch between salons and products, search by name, or scan a salon's QR code.",
    );
    expect(long).toBeGreaterThan(short);
  });

  it("never returns something too short to read", () => {
    // A bar that fills in under three seconds reads as a glitch, not as progress.
    expect(estimateSpeechSeconds("")).toBe(3);
    expect(estimateSpeechSeconds("Yes.")).toBe(3);
    expect(estimateSpeechSeconds("   ")).toBe(3);
  });

  it("puts a typical step in the range the frames were timed for", () => {
    const body =
      "Pick the day along the strip, then the time. Every time is Bhutan time, wherever you happen to be reading this.";
    const seconds = estimateSpeechSeconds(body);
    expect(seconds).toBeGreaterThan(6);
    expect(seconds).toBeLessThan(14);
  });
});

/**
 * The ranking is the whole reason this is a function rather than `voices[0]`: the installed
 * set differs on every machine, and on Windows index 0 is as likely to be a Czech voice as
 * an English one.
 */
describe("pickVoice", () => {
  it("prefers a neural voice over anything else", () => {
    const picked = pickVoice([
      voice("Microsoft David - English (United States)", "en-US"),
      voice("Google UK English Female", "en-GB", false),
      voice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB", false),
    ]);
    expect(picked?.name).toContain("Natural");
  });

  it("prefers British and Indian English to American", () => {
    // The copy is written in British English, and Ngultrum, Paro and Thimphu come out
    // closer to the mark in en-GB and en-IN.
    expect(pickVoice([voice("Alex", "en-US"), voice("Daniel", "en-GB")])?.name).toBe("Daniel");
    expect(pickVoice([voice("Alex", "en-US"), voice("Rishi", "en-IN")])?.name).toBe("Rishi");
  });

  it("avoids eSpeak when anything else is available", () => {
    const picked = pickVoice([voice("eSpeak English", "en-GB"), voice("Fred", "en-US")]);
    expect(picked?.name).toBe("Fred");
  });

  it("takes eSpeak over silence", () => {
    expect(pickVoice([voice("eSpeak English", "en-GB")])?.name).toBe("eSpeak English");
  });

  it("returns null when nothing English is installed, rather than reading English aloud in Czech", () => {
    expect(pickVoice([voice("Zuzana", "cs-CZ"), voice("Yuna", "ko-KR")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });

  it("breaks a tie on the platform's own ordering, and does not reorder the caller's array", () => {
    const voices = [voice("First", "en-GB"), voice("Second", "en-GB")];
    const copy = [...voices];
    expect(pickVoice(voices)?.name).toBe("First");
    expect(voices).toEqual(copy);
  });

  it("uses the cloud voice only as a tie-break", () => {
    // Same language, same name shape: the non-local one wins. But it must not outrank a
    // better language — an offline en-GB beats an online en-US.
    expect(pickVoice([voice("A", "en-GB", true), voice("B", "en-GB", false)])?.name).toBe("B");
    expect(pickVoice([voice("A", "en-GB", true), voice("B", "en-US", false)])?.name).toBe("A");
  });
});
