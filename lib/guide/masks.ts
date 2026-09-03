/**
 * Regions of a captured frame that must not reach the video, and why each one is there.
 *
 * ## This is not retouching
 *
 * The whole claim of this guide is that every frame is a real screen of the real app. A
 * mask that hid an inconvenient truth would break that claim, so there is exactly one thing
 * a mask is allowed to do: **remove something the shipped app does not render.**
 *
 * Both entries below are the same case. The capture harness runs `flutter test`, which
 * builds in debug, and `_DevQuickLogin` in `tho/app/lib/auth/email_sign_in_screen.dart` is
 * gated on `kDebugMode`. Its own doc comment is explicit — *"the call site gates on
 * kDebugMode, so this never renders in profile/release builds"* — so those two buttons
 * exist on the capture and on no customer's phone. Leaving them in would have the video
 * teach a sign-in shortcut that does not exist, and show what looks like a back door on the
 * product's own marketing site.
 *
 * The honest fix is a re-capture from a profile build. Until that happens, painting the
 * region in the screen's own background colour reproduces exactly what a release build
 * shows there: nothing. The frames on disk are never modified; this is applied at render
 * time, so a re-capture retires the entry rather than fighting it.
 *
 * ## Deliberately not a general-purpose crop
 *
 * A mask is a bottom cut, not an arbitrary rectangle. Painting out a row from the middle of
 * a list leaves a hole that reads as a rendering bug, and wanting one is a sign the frame
 * should be dropped instead — which is what `guides.ts` does with the nine it rejects.
 */

export type FrameMask = {
  /**
   * Everything from this percentage of the frame's height downward is painted over.
   *
   * Measured against the frame, not the visible area, so it holds through the camera push.
   */
  fromY: number;
  /** The screen's own background at that point, so the join is invisible. */
  fill: string;
};

export const FRAME_MASKS: Record<string, FrameMask> = {
  // The "Dev quick login" divider sits at ~80%; its two buttons end at ~88%. The helper
  // line above it ("Look around freely…") ends at ~77%, so 78 clears the debug block
  // without touching a word of the real screen.
  "auth/02-sign-in": { fromY: 78, fill: "#ffffff" },

  // Here the same block is already mostly below the fold — only its divider label is on
  // screen, at ~96%. The real content above it ends at ~92%.
  "auth/03-create-account": { fromY: 94, fill: "#ffffff" },
};
