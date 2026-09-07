/**
 * Which app store a visitor to `/app` should be sent to, read off the User-Agent.
 *
 * ## Why the server, and not `navigator.platform`
 *
 * `/app` is a link shared into WhatsApp, Messenger and Facebook, and those apps open it in
 * their own in-app webview, where script execution is restricted or delayed. A
 * client-side branch would leave exactly the audience this page is for staring at a page
 * that never forwards. The User-Agent arrives with the request, so the decision is made
 * before a byte is rendered and the forward needs no JavaScript at all.
 *
 * The cost is that `/app` becomes server-rendered rather than static. That is the correct
 * trade for a route whose entire job is to branch on the client.
 *
 * ## Bots are checked first, and that ordering is load-bearing
 *
 * Googlebot's smartphone agent contains **both** `Googlebot` and `Android`; Applebot's
 * mobile agent contains `iPhone`. Testing platform before bot would classify a crawler as
 * a phone and hand it a redirect, and Google treats a redirect that fires only for its
 * mobile agent as cloaking — the same content has to be served to the crawler and the
 * human. So anything that identifies as a bot resolves to `unknown`, which is the branch
 * that forwards nobody and renders both stores.
 *
 * `unknown` is therefore not a failure case. It is the honest answer for a desktop
 * browser, an unrecognised agent and every crawler, and all three want the same page: one
 * that shows both badges and moves on its own for nobody.
 */

/** The platforms `/app` can forward to, plus the answer that forwards to neither. */
export type StorePlatform = "ios" | "android" | "unknown";

/**
 * Agents that must never be forwarded — crawlers, unfurlers and preview fetchers.
 *
 * Matched case-insensitively against the whole UA string. The list is the union of the
 * platforms named in the request this page serves (WhatsApp, Facebook, Messenger,
 * LinkedIn, X) and the search engines whose cloaking rules make a UA-conditional redirect
 * a liability.
 *
 * A missing name here degrades to a redirect for that one agent, not to a broken page —
 * so this list being incomplete is a small, bounded cost, and adding to it is cheap.
 */
const BOTS = [
  // Unfurlers for the platforms this page is shared on.
  "facebookexternalhit",
  "facebookcatalog",
  "whatsapp",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "telegrambot",
  "discordbot",
  "skypeuripreview",
  "viber",
  "line-podcast",
  "redditbot",
  "pinterest",
  "vkshare",
  "embedly",
  "quora link preview",
  "outbrain",
  "nuzzel",
  "bitlybot",
  // Search and AI crawlers. `robots.ts` allows these; none may be redirected.
  "googlebot",
  "google-inspectiontool",
  "storebot-google",
  "bingbot",
  "applebot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-user",
  "claude-searchbot",
  "perplexitybot",
  "perplexity-user",
  "ccbot",
  // Generic tokens. Deliberately last and deliberately broad.
  "bot/",
  "spider",
  "crawler",
  "preview",
  "headlesschrome",
] as const;

/**
 * Resolve a User-Agent to the store it should be sent to.
 *
 * @param userAgent The raw `user-agent` header. `null` and `""` resolve to `unknown`,
 *   which is the safe branch — a request with no UA is not a phone we can identify.
 */
export function storePlatformFromUserAgent(
  userAgent: string | null | undefined,
): StorePlatform {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();

  // First, per the note above: a crawler is never forwarded, whatever else it claims.
  if (BOTS.some((bot) => ua.includes(bot))) return "unknown";

  /*
    iOS before Android, because an iOS UA cannot contain "android" but the reverse is not
    guaranteed — Android webviews in the wild have shipped UAs carrying "like iPhone".

    `ipad` is matched, and so is the iPadOS Safari case that reports itself as
    `Macintosh`: that one is genuinely undetectable server-side, which is why a Mac
    resolves to `unknown` and gets both badges rather than a guess. An iPad user tapping
    the App Store badge loses nothing; an iPad user auto-forwarded to Google Play would.
  */
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("android")) return "android";

  return "unknown";
}
