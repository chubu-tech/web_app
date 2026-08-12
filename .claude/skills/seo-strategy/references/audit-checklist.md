# SEO Audit Checklist — Line-by-Line Procedure

Reference for `seo-optimizer` agent. Run this top-to-bottom when asked to audit a site's SEO. Each section ends with a "report this" item so findings can roll up into a final table.

## 0. Discovery

```bash
# Identify the stack
cat package.json | grep -E '"next"|"next-seo"|"next-sitemap"|"@vercel/og"'
ls pages/ app/ 2>/dev/null         # which router
cat next.config.js 2>/dev/null     # redirects, headers, i18n
cat site.config.js 2>/dev/null     # base URL, languages, site name
ls public/ | grep -iE 'robots|sitemap'
```

Note in audit report:
- Next.js version
- Router type
- SEO libraries in use
- Base URL pattern (with/without trailing slash, protocol)
- Languages configured

## 1. Live snapshot

For each of homepage + 1 category + 1 product + 1 article:

```bash
URL="https://[domain]/path"
curl -sIL "$URL" | head -20                    # HTTP status, redirects, cache headers
curl -sL "$URL" | grep -iE '<title>|name="description"|rel="canonical"|property="og:|name="robots"' | head -20
curl -sL "$URL" | grep -oE '<script type="application/ld\+json">[^<]+</script>' | head -5
```

Note in audit report (per URL):
- Final HTTP status (after redirects)
- Title content + char length
- Description content + char length
- Canonical URL (if present)
- noindex/nofollow flags
- OG image URL
- JSON-LD blocks present (which @types)

## 2. Meta tag quality

For each sampled page, check:

- [ ] `<title>` present? Unique across the site? 50-60 chars? Primary keyword early? Brand at end?
- [ ] `<meta name="description">` present? Unique? 140-160 chars? Value prop + CTA?
- [ ] `<link rel="canonical">` present? Absolute URL? Self-canonical (not pointing elsewhere unintentionally)?
- [ ] `<meta name="robots">` — if present, does it correctly include/exclude the page from index?
- [ ] OG title/description/image/url present? OG image is a real image (not logo)?
- [ ] Twitter card type set?
- [ ] `<html lang>` matches actual content language?

```bash
# Find duplicate titles across the site
sitemap=$(curl -sL https://[domain]/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//')
for url in $sitemap; do
  title=$(curl -sL "$url" | grep -oE '<title>[^<]+' | head -1)
  echo "$title | $url"
done | sort | uniq -c -d -w 80   # duplicates
```

Report:
- Pages with missing or generic titles
- Pages with duplicate titles
- Pages with missing descriptions
- Pages with missing canonicals
- Pages with accidental noindex

## 3. Structured data (JSON-LD)

```bash
# Check each sampled URL for JSON-LD
curl -sL "$URL" | python3 -c "
import sys, re, json
html = sys.stdin.read()
blocks = re.findall(r'<script[^>]*application/ld\+json[^>]*>([^<]+)</script>', html)
for b in blocks:
    try:
        data = json.loads(b)
        print('---')
        print(json.dumps(data, indent=2)[:500])
    except: pass
"
```

For each JSON-LD block found, validate at https://validator.schema.org/.

Check:
- [ ] Homepage has `Organization` schema?
- [ ] Homepage has `WebSite` schema (with SearchAction if search exists)?
- [ ] Contact / location pages have `LocalBusiness`?
- [ ] Product pages have `Product` schema?
  - [ ] No `price: 0.00` or `priceCurrency` without real price?
  - [ ] No `availability: Discontinued` on active products?
  - [ ] No Mongo `_id` as `sku` or `gtin`?
  - [ ] No fabricated `aggregateRating` / `reviewCount`?
- [ ] Article pages have `Article` / `BlogPosting`?
  - [ ] `author` is a real Person with linked profile?
  - [ ] `datePublished` and `dateModified` accurate?
- [ ] Category pages have `ItemList` and/or `CollectionPage`?
- [ ] Breadcrumb visible on page + matched by `BreadcrumbList` schema?
- [ ] FAQ sections (if present) backed by `FAQPage` schema with matching visible Q&A?

Report:
- Missing schemas per page type
- Invalid schemas (fabricated data, format errors)
- Schemas not matching visible content (cloaking risk)

## 4. Sitemap & robots

```bash
curl -sL https://[domain]/sitemap.xml | head -50
curl -sL https://[domain]/robots.txt
```

Check:
- [ ] Sitemap exists and is valid XML?
- [ ] Sitemap includes all important pages?
- [ ] Sitemap excludes admin / private / parameterized junk?
- [ ] `<lastmod>` reflects real update times?
- [ ] Robots.txt allows public pages, blocks admin / API / auth routes?
- [ ] Robots.txt references sitemap URL?
- [ ] No accidental `Disallow: /` blocking the whole site?

```bash
# Count URLs in sitemap
curl -sL https://[domain]/sitemap.xml | grep -c '<loc>'

# Test a sample of sitemap URLs return 200
curl -sL https://[domain]/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//' | head -20 | while read u; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$u") $u"
done
```

Report:
- Total URLs in sitemap
- Any 404s or 5xx in sampled sitemap URLs
- Pages that exist but aren't in sitemap
- Pages in sitemap that shouldn't be there (admin, auth, etc.)

## 5. Internal linking

```bash
# Crawl one level deep, find pages with few inbound links
# (Manual via Screaming Frog or Sitebulb in real audits; for quick check:)

# How many pages link to each category page?
for cat in usi-metalice usi-interior; do
  url="https://[domain]/tipuri-de-usi/$cat"
  count=$(curl -sL https://[domain]/ | grep -oE "href=\"[^\"]*${cat}[^\"]*\"" | wc -l)
  echo "Homepage links to $cat: $count"
done
```

Check:
- [ ] Every indexable page reachable in ≤ 3 clicks from homepage?
- [ ] No orphan pages?
- [ ] Anchor text descriptive, not "click here"?
- [ ] Footer + nav exist and cover main hubs?
- [ ] Related-products / related-articles modules present on detail pages?
- [ ] Category pages link to top products?
- [ ] Blog posts cross-link to related posts and product pages?

Report:
- Orphan pages discovered
- Pages buried deeper than 3 clicks
- Weak anchor text patterns

## 6. URL structure

```bash
# Sample 20 URLs from sitemap, check format
curl -sL https://[domain]/sitemap.xml | grep -oE '<loc>[^<]+' | head -20
```

Check:
- [ ] Slugs are lowercase, kebab-case, descriptive?
- [ ] No trailing-slash inconsistency?
- [ ] No `?id=123` style URLs for content pages?
- [ ] No date stamps in URLs unless intentional (`/news/2025/...`)?
- [ ] Localized URLs use correct language paths if multilang?

Report:
- URL format inconsistencies
- Slug quality issues

## 7. Content quality

For each sampled page, check:
- [ ] Exactly one `<h1>`? Contains primary keyword?
- [ ] Heading hierarchy clean (no h1→h3 skips)?
- [ ] Main content has substance? (Word count varies by page type; 300+ for product, 800+ for article, 150+ intro on category.)
- [ ] No keyword stuffing?
- [ ] Real value proposition above the fold?
- [ ] All images have descriptive `alt` text?
- [ ] No "Lorem ipsum" or placeholder content?

```bash
# Check H1 count and content
curl -sL "$URL" | python3 -c "
import sys, re
html = sys.stdin.read()
h1s = re.findall(r'<h1[^>]*>([^<]+)</h1>', html)
print(f'H1 count: {len(h1s)}')
for h in h1s: print(f'  {h.strip()}')
"

# Count images missing alt
curl -sL "$URL" | python3 -c "
import sys, re
html = sys.stdin.read()
imgs = re.findall(r'<img[^>]*>', html)
no_alt = [i for i in imgs if 'alt=' not in i]
empty_alt = [i for i in imgs if re.search(r'alt=[\"\\\']{2}', i)]
print(f'Total images: {len(imgs)}')
print(f'Missing alt: {len(no_alt)}')
print(f'Empty alt: {len(empty_alt)}')
"
```

Report:
- Pages with missing/multiple H1s
- Pages with weak content (thin pages)
- Images missing alt across the site
- Placeholder content found

## 8. Mobile / Core Web Vitals

```bash
# Test in PageSpeed Insights (manually):
echo "https://pagespeed.web.dev/report?url=$URL"
```

Check (run for homepage + 1 product + 1 article):
- [ ] LCP < 2.5s on mobile?
- [ ] INP < 200ms?
- [ ] CLS < 0.1?
- [ ] Mobile usability passing? (no horizontal scroll, tap targets sized, text legible)
- [ ] Above-fold images use `priority`?
- [ ] Layout-shifting fonts use `font-display: swap`?
- [ ] Third-party scripts deferred?

Report:
- Pages failing any CWV metric
- Specific bottlenecks (large hero, blocking JS, etc.)

Defer deep performance work to the `website-speed-audit` skill.

## 9. International / hreflang

If site is multilang:
- [ ] `hreflang` attributes present in `<head>`?
- [ ] Each language version cross-links to all others (bidirectional)?
- [ ] `hreflang="x-default"` set?
- [ ] Each language has unique content (not auto-translated nonsense)?

If site is single-lang:
- [ ] No stray hreflang to non-existent versions?

## 10. Backend / API SEO

```bash
# Check what SEO fields exist on entity models
grep -rE 'metaTitle|metaDescription|seo:' /path/to/api/models/ | head -20
```

Check:
- [ ] Public-facing entities (products, articles, categories) have `seo.metaTitle` and `seo.metaDescription` fields?
- [ ] `slug` field with proper validation regex?
- [ ] Admin forms expose SEO fields via `SlugInput` + `Field` components?
- [ ] No PII (emails, phones) accidentally indexed via public API responses?

Report:
- Entities missing SEO fields
- Admin UI gaps (SEO fields not editable)

## 11. Search Console / live signals

(Manual steps to recommend to user)

- [ ] Search Console verified and connected?
- [ ] Sitemap submitted in Search Console?
- [ ] "Coverage" report — any errors or warnings?
- [ ] "Enhancements" report — any structured data errors?
- [ ] Manual actions panel — any active penalties?
- [ ] Mobile usability report clean?
- [ ] Core Web Vitals report (28-day rolling) passing?
- [ ] Top queries make sense for the business?

## 12. Anti-patterns spot check

Run grep across the codebase:

```bash
# Fabricated review numbers
grep -rE 'aggregateRating|reviewCount|ratingValue' --include='*.js' --include='*.jsx' src/ pages/ components/

# Suspicious price hardcodes
grep -rE "price.*['\"]0\.00|price.*['\"]0['\"]" --include='*.js' --include='*.jsx' .

# Discontinued / hardcoded availability
grep -rE 'Discontinued|availability.*hardcoded' --include='*.js' --include='*.jsx' .

# Stray noindex
grep -rE 'noindex' --include='*.js' --include='*.jsx' .

# Mongo _id used as identifier in schema
grep -rE 'gtin.*_id|sku.*_id' --include='*.js' --include='*.jsx' .

# Multiple h1 in same component
grep -rE '<h1' --include='*.jsx' components/ | sort | uniq -c | sort -rn | head -20
```

Report any hits — each one is a P0 or P1 fix.

## Final report format

Output as a table:

| Priority | Category | Page/Scope | Issue | Why it matters | Fix | Est. hours |
|---|---|---|---|---|---|---|
| P0 | Schema | All products | ProductJsonLd uses `availability: Discontinued` and `price: 0.00` | Google de-prioritizes rich snippets; potential spam flag | Conditionally render `offers` only when real price exists; default to InStock | 2-3h |
| P0 | Schema | All products | `gtin: product._id` is invalid | Search Console warnings | Remove `gtin` field unless real GTIN; use real SKU for `sku` | 1h |
| P1 | Meta | Category pages | No canonical, generic description | Lost ranking signals | Add canonical + fallback description in `[slug].js` | 2h |
| P1 | Schema | Homepage | No Organization schema | Brand identity not asserted | Add OrganizationSchema component in `_app.js` | 2h |
| P2 | Content | Homepage hero | "Welcome to..." style title | Weak CTR | Rewrite with value prop | 1h |

Priority definitions:
- **P0**: Active SEO damage. Wrong signals being sent. Fix immediately.
- **P1**: Missing high-value signals or weak fallbacks. Fix this week.
- **P2**: Polish, advanced optimization. Fix when capacity allows.

Always include effort estimates so user can sequence work against budget.
