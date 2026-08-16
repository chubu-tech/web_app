import type { MetadataRoute } from "next";
import { absoluteUrl, DISALLOWED_PATHS, SITE_URL } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * There was none, which is not the same as "allow everything": with no robots and no
 * sitemap, a crawler's only route into this app is whatever links to it, and it spends
 * its budget on `/bookings`, `/cart` and `/profile` — 25 customer routes and 26 console
 * routes, nearly all of which redirect a signed-out visitor. The public half is four
 * shapes: Discover, a salon, a stylist, the map.
 *
 * The disallow list is `DISALLOWED_PATHS`, shared with the `noindex` metadata on those
 * routes, so the two cannot disagree about what is private. **Both are needed and they
 * do different jobs**: `robots.txt` stops the fetch, `noindex` stops the *indexing* of a
 * URL that was reached some other way — a shared link, a referrer — which robots.txt
 * alone cannot, because a disallowed URL can still be indexed from external links with
 * no snippet.
 *
 * ## The AI crawlers are named, and the policy is "allow"
 *
 * This file used to carry one rule — `userAgent: "*"` — which allowed every AI crawler
 * **by omission**. That was very probably the right position and it was not a decision:
 * nobody had written it down, so nobody could review it. It is written down now, and it
 * is unchanged in effect and deliberate in intent.
 *
 * The distinction that matters is **training** versus **retrieval**. A training crawler
 * builds a model; a retrieval crawler builds the index an assistant cites *from*. Both
 * are allowed here, because the problem this product has is being found at all: a salon
 * marketplace in a country of under a million people wants to be the thing an assistant
 * names when somebody asks where to get a haircut in Thimphu, and that requires being in
 * the retrieval index. Declining the training half while asking for the citation half is
 * a coherent position for a publisher with a back catalogue and an incoherent one here,
 * where the corpus is thirty pages of product copy.
 *
 * Two things about the mechanics are easy to get wrong and both are load-bearing:
 *
 * - **A named rule does not inherit the wildcard's disallows.** An agent that matches its
 *   own block ignores `*` entirely — so `DISALLOWED_PATHS` is spread into every rule
 *   rather than stated once. Omitting it from a named block would hand that crawler the
 *   account routes the wildcard rule carefully withholds. This is the entire reason
 *   `DISALLOWED_PATHS` is a shared constant and not a literal list.
 * - **`Google-Extended` is not a crawler.** It fetches nothing; it is a token that gates
 *   whether already-crawled content may ground Gemini and AI Overviews. Disallowing it
 *   does not remove the site from Google Search and does not change ranking — and there
 *   is no way to appear in Search while being excluded from AI Overviews except the
 *   snippet controls, which also strip the ordinary search snippet. For a marketplace
 *   whose problem is discovery, allowing it is the only sensible answer.
 *
 * **Agent names are a moving target.** Vendors rename bots and split one into two, and a
 * rule naming a retired agent is a rule that does nothing while looking deliberate. This
 * list was checked against each vendor's published documentation when written; re-check
 * it rather than trusting it, and note that a *missing* name here still falls through to
 * the wildcard rule, which allows — so the failure mode of a stale list is "allowed
 * anyway", not "silently blocked".
 */

/** Retrieval and training agents, allowed explicitly. See the note above. */
const AI_AGENTS = [
  // OpenAI: training corpus, ChatGPT's search index, and a live per-prompt fetch.
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic: crawler, user-triggered fetch, search index.
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  // Perplexity: index and live fetch.
  "PerplexityBot",
  "Perplexity-User",
  // Robots tokens rather than fetchers — they gate grounding, not crawling.
  "Google-Extended",
  "Applebot-Extended",
  // Common Crawl, which most open models are trained from.
  "CCBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  const disallow = [...DISALLOWED_PATHS];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Each named agent repeats the disallow list, because a matched rule replaces the
      // wildcard rather than extending it.
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
