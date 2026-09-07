import { describe, expect, it } from "vitest";
import { storePlatformFromUserAgent as target } from "./store-target";

/**
 * Real User-Agent strings, not invented ones. The bot cases are the point of the suite:
 * two of them contain a platform token and would be classified as phones by any
 * implementation that tested platform first.
 */

describe("storePlatformFromUserAgent", () => {
  it("sends iPhones and iPads to the App Store", () => {
    expect(
      target(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios");
    expect(
      target(
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios");
    // Chrome and Firefox on iOS. Both still carry the device token.
    expect(target("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/126.0")).toBe(
      "ios",
    );
    expect(target("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) FxiOS/127.0")).toBe(
      "ios",
    );
  });

  it("sends Android phones to Play", () => {
    expect(
      target(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("android");
    // Samsung Internet, and an in-app webview — both common in Bhutan.
    expect(
      target("Mozilla/5.0 (Linux; Android 13; SM-A155F) SamsungBrowser/25.0 Chrome/121.0"),
    ).toBe("android");
    expect(
      target("Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) Chrome/126.0 Mobile"),
    ).toBe("android");
  });

  it("forwards no crawler, including the two that claim to be phones", () => {
    /*
      These two are the reason `BOTS` is tested before the platform patterns. Googlebot's
      smartphone agent says `Android`; Applebot's says `iPhone`. Serving either a redirect
      that a desktop visitor does not get is cloaking.
    */
    expect(
      target(
        "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.33 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe("unknown");
    expect(
      target(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1 (Applebot/0.1; +http://www.apple.com/go/applebot)",
      ),
    ).toBe("unknown");
  });

  it("forwards none of the unfurlers this page exists for", () => {
    // If any of these were redirected they would unfurl the store's card, not ours —
    // which is the entire failure `/app` was built to prevent.
    for (const ua of [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0 A",
      "Twitterbot/1.0",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Jakarta Commons-HttpClient/3.1)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "SkypeUriPreview Preview/0.5",
    ]) {
      expect(target(ua), ua).toBe("unknown");
    }
  });

  it("shows both badges to desktop, where there is nothing to infer", () => {
    expect(
      target(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toBe("unknown");
    /*
      iPadOS Safari reports itself as a Mac and is not distinguishable from one without
      touch detection, which needs script. `unknown` is the deliberate answer: both badges,
      no forward. Guessing iOS here would send a real Mac to the App Store.
    */
    expect(
      target(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      ),
    ).toBe("unknown");
    expect(target("Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0")).toBe("unknown");
  });

  it("treats a missing or empty User-Agent as unknown rather than guessing", () => {
    expect(target(null)).toBe("unknown");
    expect(target(undefined)).toBe("unknown");
    expect(target("")).toBe("unknown");
  });

  it("is case-insensitive, since header casing is not guaranteed", () => {
    expect(target("MOZILLA/5.0 (IPHONE; CPU IPHONE OS 17_5 LIKE MAC OS X)")).toBe("ios");
    expect(target("MOZILLA/5.0 (LINUX; ANDROID 14; PIXEL 8)")).toBe("android");
    expect(target("FACEBOOKEXTERNALHIT/1.1")).toBe("unknown");
  });
});
