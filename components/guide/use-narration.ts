"use client";

import { useEffect, useRef, useState } from "react";
import { NARRATION_RATE, estimateSpeechSeconds, pickVoice } from "@/lib/guide/narration";

/**
 * Speak one frame's narration, and say when it has finished.
 *
 * The ranking, the pace and the estimate live in `lib/guide/narration.ts`, which is pure and
 * tested. What is here is the part that only exists in a browser: the utterance, its
 * lifecycle, and the four ways `speechSynthesis` misbehaves.
 *
 * ## Four browser bugs this works around, none of them hypothetical
 *
 * - **`cancel()` fires `end`.** Every browser reports an interrupted utterance as finished,
 *   so a naive `onend` handler advances the guide *because* you paused it. Each utterance
 *   carries a token and only the current one is allowed to report; cancelling clears it
 *   first.
 * - **Chrome stops speaking after about fifteen seconds.** A long utterance is silently cut
 *   off mid-sentence. The documented workaround is to `resume()` on a heartbeat while it is
 *   still speaking, which is what the interval does — it is a no-op on a browser without the
 *   bug.
 * - **`end` sometimes never arrives** (Android WebView, and Safari when the tab is
 *   backgrounded). Without a fallback the guide stops dead on one frame, so a timer sized
 *   from the estimate plus a generous margin finishes the step anyway.
 * - **Voices arrive late.** `getVoices()` is empty until the engine has loaded on Chrome, so
 *   the voice is chosen at speak time and re-chosen if `voiceschanged` fires.
 *
 * ## A recorded voiceover would land here
 *
 * `audio` takes precedence over the synthesiser when a step carries one, so a studio
 * recording is a data change rather than a rewrite: fill in `GuideStep.audio` and this plays
 * the file, with the same start, stop and finish contract.
 */
export function useNarration({
  text,
  audio,
  enabled,
  playing,
  onFinished,
}: {
  /** What to say. Ignored when `audio` is set. */
  text: string;
  /** A recorded clip for this step, if one exists. */
  audio?: string;
  /** The viewer's sound preference. */
  enabled: boolean;
  /** Whether the guide is running. Pausing stops the voice mid-sentence. */
  playing: boolean;
  /** Called once, when this frame's narration has finished of its own accord. */
  onFinished: () => void;
}): { supported: boolean } {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );

  // The callback changes identity on every render of the player, and it must not restart the
  // narration when it does — the effect below depends on what is being said, not on who is
  // listening.
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (!enabled || !playing || (!text && !audio)) return;

    let live = true;
    const done = () => {
      if (!live) return;
      live = false;
      finished.current();
    };

    // A recording, when there is one.
    if (audio) {
      const clip = new Audio(audio);
      clip.addEventListener("ended", done);
      // A file that will not play must not strand the guide on this frame.
      clip.addEventListener("error", done);
      void clip.play().catch(done);
      return () => {
        live = false;
        clip.pause();
        clip.removeEventListener("ended", done);
        clip.removeEventListener("error", done);
      };
    }

    if (!supported) return;

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = NARRATION_RATE;

    const chosen = pickVoice(synth.getVoices());
    // `null` is not "no voice" — it hands the choice back to the browser, whose default is a
    // better guess than anything this module can make about a machine with no English voice.
    if (chosen) {
      utterance.voice = synth.getVoices().find((v) => v.name === chosen.name) ?? null;
    }

    utterance.onend = done;
    // `interrupted` and `canceled` are what a deliberate stop looks like; the token has
    // already been cleared by then, so `done` no-ops. Anything else is a real failure and
    // must still let the guide move on.
    utterance.onerror = done;

    // Cancel first: Chrome queues utterances, so without this a fast Next leaves the
    // previous frame's sentence still being read over the new one.
    synth.cancel();
    synth.speak(utterance);

    const heartbeat = setInterval(() => {
      if (synth.speaking) synth.resume();
    }, 9000);

    // The floor is the estimate; the margin is what makes it a fallback rather than a
    // competing clock — it should only ever fire on a browser that never sent `end`.
    const fallback = setTimeout(done, (estimateSpeechSeconds(text) + 6) * 1000);

    return () => {
      live = false;
      clearInterval(heartbeat);
      clearTimeout(fallback);
      utterance.onend = null;
      utterance.onerror = null;
      synth.cancel();
    };
  }, [text, audio, enabled, playing, supported]);

  return { supported };
}
