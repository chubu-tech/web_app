# SEO Anti-Patterns — Extended Catalog

Reference for `seo-optimizer` agent. Things to refuse, push back on, or flag immediately when seen in code or in client recommendations.

Each entry has: **What it is**, **Why it fails**, **What to do instead**, **How to detect it**.

---

## Structured data fabrications

### Fake aggregate ratings

**What**: `aggregateRating: { ratingValue: '4.8', reviewCount: '102' }` when the site has no actual reviews displayed or aggregated from a real source.

**Why it fails**: Direct violation of Google's spam policies on structured data. Detectable when:
- No reviews visible on the page
- ReviewCount doesn't change over time
- Same numbers appear on every product
- Schema doesn't match Google's user feedback signals

Consequence: Manual action against the site, removal of rich snippets, possible ranking penalty. Recovery takes months.

**Instead**: Only mark up real reviews. If you don't have reviews, omit the schema. Use Google Business Profile reviews aggregator if you have local reviews. Use a real review platform (Trustpilot, Trusted Shops) and reference it.

**Detect**:
```bash
grep -rE "aggregateRating|reviewCount|ratingValue" --include="*.js" --include="*.jsx" .
```
For each hit, verify: where does the data come from? Is it dynamically pulled from a real source? Is the value displayed on the page?

---

### Fake authors

**What**: Stock photo + made-up name + invented bio on blog posts to satisfy E-E-A-T.

**Why it fails**: Google's reverse image search detects stock photos. Cross-checks author name against the rest of the web. Detectable patterns:
- Author has no other internet presence
- Author photo found on stock photo sites
- Multiple "authors" use the same writing style (LLM detector hits)
- Author page is a stub with no real bio

Consequence: Reduced trust signal, potential Helpful Content algorithm demotion.

**Instead**: Use real employees with real photos. Even one real author is better than five fake ones. If no employee can be the public author, attribute to the organization (`author: { '@type': 'Organization', name: 'Brand' }`) — less powerful for E-E-A-T but honest.

**Detect**:
- Author profile page exists?
- Photo is unique (reverse search)?
- LinkedIn / public profile exists and matches?
- Other people in the company know this person?

---

### Marking content not visible on the page

**What**: FAQPage schema for questions that don't appear in the page's HTML. Product schema for products not on the page. Reviews in schema but not in DOM.

**Why it fails**: Google's structured data guidelines explicitly require the marked-up content to be visible to users. Detectable via simple DOM diff.

**Consequence**: Spam policy violation, removal of rich snippets, sometimes manual action.

**Instead**: Either show the content on the page, or remove the schema. Lazy-loaded content that appears on scroll is OK if it's in the initial HTML.

**Detect**: For each schema block, verify each schema field maps to visible page text.

---

### Mongo `_id` as `sku` or `gtin`

**What**: `sku: product._id` or `gtin: product._id` in ProductJsonLd.

**Why it fails**:
- `gtin` requires a real Global Trade Item Number (8, 12, 13, or 14 digits, with checksum). A 24-char hex string is rejected.
- `sku` accepts any string but should be your real Stock Keeping Unit. Mongo IDs aren't SKUs.

**Consequence**: Search Console structured data warnings, products excluded from Google Shopping eligibility.

**Instead**:
- For `sku`: use real product SKU from your inventory system. If none exists, add one to the model.
- For `gtin`: omit if you don't have a real one. Optional field; missing is better than wrong.

**Detect**:
```bash
grep -rE 'gtin.*_id|sku.*_id|sku.*product\._id' --include="*.js" --include="*.jsx" .
```

---

### Price 0.00 with InStock availability

**What**: `offers: { price: '0.00', priceCurrency: 'RON', availability: 'InStock' }` rendered for all products regardless of whether real price exists.

**Why it fails**:
- Schema validators flag invalid price.
- Google treats free products differently in Shopping ads.
- Misleads users via SERP preview.

**Consequence**: Rich snippets suppressed, possible flagging.

**Instead**: Conditional render. If product has no real price (B2B catalog, distribution model):
- Either omit `offers` entirely
- Or use `availability: 'InStoreOnly'` with no price field
- Or contact the price source / API to expose real prices

**Detect**:
```bash
grep -rE "price.*['\"]0\.00['\"]|price.*['\"]0['\"]" --include="*.js" --include="*.jsx" .
```

---

### `Discontinued` availability on active products

**What**: `availability: 'https://schema.org/Discontinued'` hardcoded on all products.

**Why it fails**: `Discontinued` tells Google the product is permanently unavailable. Google removes it from Shopping, suppresses rich snippets, may eventually de-index.

**Consequence**: Product pages lose visibility over time.

**Instead**: Map availability to real product state:
- `InStock` — buyable now
- `OutOfStock` — temporarily unavailable
- `PreOrder` — coming soon
- `BackOrder` — restock incoming
- `InStoreOnly` — physical only
- `Discontinued` — only when truly removed forever

If you have no inventory tracking, default to `InStock` for active products (assuming they're listed because they're available).

**Detect**:
```bash
grep -rE "Discontinued|OutOfStock" --include="*.js" --include="*.jsx" .
```
For each hit, check: is this conditional on real product state, or hardcoded?

---

## Content / on-page anti-patterns

### Keyword stuffing in title/description

**What**: `<title>Uși metalice ieftine București | Uși metalice apartament | Uși metalice exterior | Cele mai bune uși metalice</title>`

**Why it fails**:
- Google ignores stuffed keywords (post-2013).
- CTR drops because users see spam.
- Wastes title pixel budget.

**Instead**: One primary keyword, one modifier, brand. Write for users:
- `Uși Metalice Apartament – Securitate Clasa 4 | MegaDoor`

**Detect**: Check if same root keyword appears > 1 time in title or > 2 times in description.

---

### Doorway pages (city + service combos)

**What**: 200 pages like `/usi-metalice-bucuresti`, `/usi-metalice-cluj`, `/usi-metalice-iasi` — same content with city name swapped.

**Why it fails**: Google explicitly defines doorway pages as a spam pattern. Manual action risk. Detected via near-duplicate content analysis.

**Instead**: 
- One strong service page covering the whole country.
- If location matters, build genuine per-city content (real store address, local case studies, photos of actual installations in that city).
- Use real LocalBusiness schema only for real physical locations.

**Detect**: Sitemap with N variants of the same URL pattern + low content uniqueness.

---

### Thin / auto-generated content

**What**: Pages auto-generated from product database with no human editorial value. "Buy [product name] online" + spec table + nothing else.

**Why it fails**: Google's Helpful Content System (now part of core algorithm) explicitly demotes content that exists only to rank, not to help users.

**Instead**:
- Add real content per page: benefits, use cases, comparisons, photos, expert commentary.
- For genuinely templated pages (e.g., 10,000 SKU pages), accept that long-tail rankings may be modest. Focus content effort on category and hub pages instead.

**Detect**: Pages where word count is <100 (excluding nav/footer) and unique content is <50 words.

---

### Hidden text / cloaking

**What**: 
- White text on white background ("for SEO")
- `display: none` content that contains keywords
- Different content served to user-agent="Googlebot" vs real users

**Why it fails**: Among the oldest forbidden tactics. Detectable. Triggers manual action.

**Instead**: Show all content you want indexed. If a section is genuinely UI-collapsed (accordion), the content must still be in the initial HTML — collapsed by CSS/JS, not absent.

**Detect**:
```bash
# Find display:none with text content
grep -rE 'display:\s*none' --include="*.jsx" --include="*.css" .
```

User-agent sniffing is harder to grep; check server-side rendering logic if suspicious.

---

### Buying / exchanging backlinks

**What**: Paying for links, link exchanges, PBN (private blog network) participation.

**Why it fails**:
- Google's Link Spam Update (Dec 2022 + ongoing) is increasingly effective at detection.
- Penalty rolls into core updates.
- Recovery from manual action takes months and requires disavow file submission.

**Instead**:
- Earn links via: original research, expert content, PR, partnerships, broken-link building.
- Build a digital PR function if scale matters.
- Local citations (Google Business, Yelp, industry directories) are legitimate — bulk citation services are gray-area; vet manually.

**Refuse**: If the user asks you to advise on link buying, link exchange schemes, or PBN setup, decline and explain the risk.

---

## Technical anti-patterns

### Canonical pointing to a different page's content

**What**: Page A has `<link rel="canonical" href="https://site.com/page-b">` when A and B have different content.

**Why it fails**:
- Google may de-index page A entirely (consolidating to B).
- Conflicting signals: link equity goes to B but users land on A.

**Instead**: Self-canonical is the safe default. Cross-canonical only when:
- A is a duplicate of B (e.g., http vs https, www vs non-www)
- A is a paginated/filtered variant where B is the "canonical view"

**Detect**:
```bash
# For each page, compare canonical URL to actual URL
for url in $(curl -sL https://[domain]/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//'); do
  canonical=$(curl -sL "$url" | grep -oE 'rel="canonical" href="[^"]+"' | head -1)
  echo "$url -> $canonical"
done | grep -v "$(basename $url)"
```

---

### Stray noindex left on after launch

**What**: Page was set to noindex during development, never removed. New product/article/page that should be indexed isn't.

**Why it fails**: Page simply doesn't appear in search. Easy to miss because the page loads fine for users.

**Instead**: Quarterly grep for `noindex` across the codebase. Verify each instance is intentional (thank-you pages, internal pages, etc.).

**Detect**:
```bash
grep -rE 'noindex' --include="*.js" --include="*.jsx" .
# Then check Search Console "Excluded" report for noindex'd URLs.
```

---

### Adding hreflang for unpopulated languages

**What**: Site has Romanian content only. `hreflang` tags claim English version exists, but `/en/` returns 404 or auto-translated/empty content.

**Why it fails**:
- Soft-404 perception.
- User trust damaged (lands on empty English page).
- Google may ignore all hreflang signals after detecting broken ones.

**Instead**: Only add hreflang when each language version has real, unique content. Adding empty placeholders is worse than no multi-language setup.

**Detect**:
```bash
# For each hreflang URL, check it returns a real 200 with content
for href in $(curl -sL https://[domain]/ | grep -oE 'hreflang="[^"]+" href="[^"]+"' | grep -oE 'href="[^"]+"'); do
  curl -s -o /dev/null -w "%{http_code} $href\n" $href
done
```

---

### Wrong trailing-slash policy

**What**: Internal links sometimes use `/about`, sometimes `/about/`, sometimes mixed. Server may serve both with 200 status.

**Why it fails**:
- Two URLs indexed as separate pages.
- Link equity split.
- Canonical confusion.

**Instead**: Pick one (with or without trailing slash) and enforce site-wide via:
- 301 redirects from the wrong format to the correct one
- Consistent internal linking
- Canonical tags

**Detect**:
```bash
# Check if both versions resolve
curl -sIL "https://[domain]/about" | head -1
curl -sIL "https://[domain]/about/" | head -1
# Both should NOT be 200. One should 301 to the other.
```

---

### Robot blocking too aggressively

**What**: `robots.txt` with `Disallow: /` or excessive disallows that block crawlable content.

**Why it fails**: Pages can't be crawled or indexed.

**Instead**: Allow public content, block only:
- Admin / API routes
- Auth / account routes
- Search results (noindex+follow is better for these)
- Tracking parameters (`?utm_*`)
- Print-friendly duplicates

**Detect**:
```bash
curl -sL https://[domain]/robots.txt
# Verify each Disallow corresponds to non-public content.
```

---

### Slow JS-only rendering of critical content

**What**: H1, primary content, internal links all rendered via client-side React on initial load. Crawler gets a near-empty HTML shell.

**Why it fails**:
- Google has gotten better at JS rendering but it's still:
  - Slower (two-pass indexing, delayed updates)
  - More expensive (Google may render less of high-volume sites)
  - Bing and other crawlers worse at JS

**Instead**: Use `getServerSideProps` or `getStaticProps` to render critical SEO content server-side. View source should contain the H1, meta tags, main content text, internal links.

**Detect**:
```bash
# Compare rendered HTML vs view source
curl -sL "https://[domain]/page" > /tmp/source.html
echo "H1 in source: $(grep -c '<h1' /tmp/source.html)"
echo "Main content words: $(grep -oE '<p>[^<]*</p>' /tmp/source.html | wc -w)"
# If H1 missing or content < 100 words, JS-rendered.
```

---

### Auto-translated content

**What**: Site uses Google Translate widget or similar to "support" multiple languages. Content quality is poor.

**Why it fails**:
- Google detects machine translation; treats as low-quality.
- User experience suffers.
- Not real internationalization.

**Instead**: Either professionally translate each language version (real human translator + local review), or stick to one language and target that audience properly.

**Refuse**: If user asks to add Google Translate widget "for SEO", explain that it actively hurts.

---

## Recovery patterns (when finding these in the wild)

### Found fabricated schema

1. Remove the schema immediately (the spam policy violation is active as long as it's deployed).
2. Resubmit affected pages in Search Console URL Inspection.
3. If manual action exists, file reconsideration request after cleanup.
4. Expect 30-90 day recovery cycle.

### Found wrong canonical / noindex

1. Fix the markup.
2. Resubmit in Search Console.
3. Most pages re-index within 1-2 weeks.

### Found mass-doorway pages

1. Decide: do these have a legitimate use case? If yes, consolidate to one strong page + 301 redirect duplicates. If no, remove the URLs and 410 the responses.
2. Update sitemap.
3. Submit removed URLs to Search Console for fast de-indexing.

### Found bought links pointing in

1. Audit backlinks (Ahrefs / Semrush export).
2. Reach out to webmasters to remove worst links.
3. Disavow remaining toxic links in Search Console.
4. Expect 6-12 month recovery if penalty exists.

---

## When to push back vs comply

| User request | Response |
|---|---|
| "Add fake reviews to product schema" | REFUSE. Explain spam policy risk. |
| "Make 100 location pages for SEO" | DISCUSS. Suggest legitimate alternatives (one strong page + real per-location content if multiple stores exist). |
| "Use stock photo for author bio" | DISCUSS. Suggest finding a real employee author. Decline if pushed. |
| "Auto-generate 1000 product descriptions with AI and call it human" | DISCUSS. Suggest combining AI draft + human review/edit + real value-add per page. |
| "Block competitor mentions via robots.txt" | EXPLAIN this doesn't work the way they think. robots.txt is about your own crawling. |
| "Use Google Translate widget for multilang" | DISCUSS. Explain it hurts SEO; recommend proper i18n if multilang is a real goal. |
| "Make schema include products we don't sell" | REFUSE. Spam policy violation. |
| "Hide pricing from schema to manipulate Shopping" | DISCUSS. Better strategies for B2B catalogs exist (Product without offers). |

The pattern: refuse outright fabrications and spam-policy violations. For gray-area asks, explain the risk, suggest the legitimate alternative, comply if user accepts the risk after warning (and document the warning).
