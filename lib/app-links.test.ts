import { describe, expect, it } from "vitest";
import {
  ANDROID_PACKAGE,
  APP_STORE_URL,
  PLAY_STORE_URL,
  detectMobilePlatform,
  storeUrlFor,
} from "./app-links";

/**
 * There is no Dart original for any of this — the Flutter app never has to work out which
 * store to send somebody to, because it *is* the app. This is web-only ground.
 *
 * The user agents below are real strings, not sketches. A UA test written against an
 * invented string proves the regex matches the invention.
 */
const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  /** iPadOS 13+ reports itself as a Mac — indistinguishable from a desktop by UA alone. */
  ipadModern:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  /** The in-app browser this feature mostly exists for. */
  whatsappAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/447.0.0.32.107;]",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const;

describe("detectMobilePlatform", () => {
  it("identifies an iPhone", () => {
    expect(detectMobilePlatform(UA.iphone)).toBe("ios");
  });

  it("identifies an Android phone", () => {
    expect(detectMobilePlatform(UA.androidPhone)).toBe("android");
  });

  it("identifies an Android in-app browser", () => {
    // The WhatsApp/Facebook webview is the case the whole hand-off exists for: it does
    // not honour App Links, so it is where the manual control has to appear.
    expect(detectMobilePlatform(UA.whatsappAndroid)).toBe("android");
  });

  it("identifies an old iPad by its own name", () => {
    expect(detectMobilePlatform(UA.ipadLegacy)).toBe("ios");
  });

  it("identifies an iPadOS 13+ iPad by its touch points", () => {
    // The UA is a Mac's. Only `maxTouchPoints` separates the two, which is why the
    // function takes it rather than reading `navigator` itself.
    expect(detectMobilePlatform(UA.ipadModern, 5)).toBe("ios");
  });

  it("does not mistake a desktop Mac for an iPad", () => {
    // Same UA family as the case above, and it must answer differently. A Mac reports 0.
    expect(detectMobilePlatform(UA.ipadModern, 0)).toBeNull();
    expect(detectMobilePlatform(UA.mac, 0)).toBeNull();
  });

  it("treats a single touch point as a desktop", () => {
    // `> 1`, not `> 0` — a touch-capable Mac display should not claim to be an iPad.
    expect(detectMobilePlatform(UA.ipadModern, 1)).toBeNull();
  });

  it("returns null for a desktop browser", () => {
    expect(detectMobilePlatform(UA.windows)).toBeNull();
    expect(detectMobilePlatform("")).toBeNull();
  });

  it("prefers Android over the Apple branches", () => {
    // An Android UA contains "Linux" and "Mobile Safari"; ordering is what keeps a
    // Samsung phone from being read as an iPhone.
    expect(detectMobilePlatform(UA.androidPhone, 5)).toBe("android");
  });
});

describe("storeUrlFor", () => {
  it("sends each platform to its own listing", () => {
    expect(storeUrlFor("ios")).toBe(APP_STORE_URL);
    expect(storeUrlFor("android")).toBe(PLAY_STORE_URL);
  });

  it("returns null for an unknown platform", () => {
    // The caller shows both listings rather than guessing — sending an Android user to
    // an iPhone-only listing is worse than offering a choice.
    expect(storeUrlFor(null)).toBeNull();
  });
});

describe("the store URLs", () => {
  it("carries the Bhutan storefront segment on the App Store link", () => {
    // Measured upstream in `brand.appListing`: the storefront-less form is a 404 for this
    // app, because it is published to Bhutan only. Asserted as a *property* rather than a
    // whole string, because the `tho-bt` slug is Apple's and moves when the listing is
    // renamed — pinning it would make this test fail on a rename that broke nothing.
    expect(APP_STORE_URL).toContain("apps.apple.com/bt/app/");
    expect(APP_STORE_URL).toContain("id6801982891");
  });

  it("keys the Play link by the app's real applicationId", () => {
    // Must match `applicationId` in the app's build.gradle.kts and the package named by
    // `public/.well-known/assetlinks.json`, or the App Links hand-off breaks silently.
    expect(ANDROID_PACKAGE).toBe("bt.tho.app");
    expect(PLAY_STORE_URL).toBe(
      `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
    );
  });
});
