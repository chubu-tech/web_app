# Schema.org Catalog — Copy-Paste Templates with Guidance

Reference for `seo-optimizer` agent. Each schema below has: when to use, full JSON template, field-by-field guidance, common mistakes, and validation tips.

## How to read this file

- **Required fields** are marked `(REQUIRED)`.
- **Recommended fields** are marked `(rec)`.
- **Optional but high-value** fields are marked `(opt)`.
- Anything else is rarely useful and skippable.

Always validate output at https://validator.schema.org/ and Google's Rich Results Test before shipping.

---

## Organization

**Use on**: Homepage only. Renders once, applies brand-wide.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Brand Name",
  "legalName": "Legal Entity SRL",
  "alternateName": "BrandShortName",
  "url": "https://example.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://example.com/images/logo.png",
    "width": 600,
    "height": 60
  },
  "image": "https://example.com/images/og-default.jpg",
  "description": "One-line description of what the company does.",
  "foundingDate": "1999",
  "founders": [
    { "@type": "Person", "name": "Founder Name" }
  ],
  "numberOfEmployees": {
    "@type": "QuantitativeValue",
    "value": "50"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Real street + number",
    "addressLocality": "City",
    "postalCode": "010101",
    "addressCountry": "RO"
  },
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "+40-XXX-XXX-XXX",
      "contactType": "sales",
      "areaServed": "RO",
      "availableLanguage": ["Romanian", "English"]
    },
    {
      "@type": "ContactPoint",
      "telephone": "+40-YYY-YYY-YYY",
      "contactType": "customer support",
      "areaServed": "RO",
      "availableLanguage": "Romanian"
    }
  ],
  "sameAs": [
    "https://facebook.com/brand",
    "https://instagram.com/brand",
    "https://www.linkedin.com/company/brand",
    "https://www.youtube.com/@brand",
    "https://www.tiktok.com/@brand"
  ]
}
```

**Field guidance:**
- `@type`: Pick the most specific subtype. Common: `Organization`, `LocalBusiness`, `Corporation`, `HomeAndConstructionBusiness`, `Store`, `Restaurant`, `MedicalBusiness`.
- `name` (REQUIRED): Brand name as users know it.
- `url` (REQUIRED): Homepage URL with protocol.
- `logo` (rec): ImageObject preferred over string. Min 112x112px. Square or wide rectangle.
- `sameAs` (rec): Only real, active profiles. Empty list is better than dead links.
- `telephone`: E.164 format (`+CountryCodeNumber`). Internal hyphens OK.
- `foundingDate`: ISO 8601 (`YYYY` or `YYYY-MM-DD`).

**Common mistakes:**
- Using `logo` URL of an SVG without dimensions (Google needs raster + dimensions).
- Listing inactive social profiles in `sameAs`.
- Multiple Organization blocks across the site (consolidate to one on homepage).

---

## LocalBusiness (and subtypes)

**Use on**: Contact page, location-specific landing pages. One block per physical location.

```json
{
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  "@id": "https://example.com/contact#showroom-bucuresti-colentina",
  "name": "Brand Name – Showroom Colentina",
  "image": "https://example.com/images/showroom-colentina.jpg",
  "url": "https://example.com/contact",
  "telephone": "+40-XXX-XXX-XXX",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Strada Colentina nr. X",
    "addressLocality": "București",
    "postalCode": "021171",
    "addressCountry": "RO"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 44.4502,
    "longitude": 26.1462
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "10:00",
      "closes": "14:00"
    }
  ],
  "areaServed": {
    "@type": "Country",
    "name": "Romania"
  },
  "parentOrganization": {
    "@type": "Organization",
    "name": "Brand Name",
    "url": "https://example.com"
  }
}
```

**Most useful LocalBusiness subtypes:**

| Industry | Type |
|---|---|
| Construction/doors/windows | `HomeAndConstructionBusiness` |
| Retail store | `Store` |
| Restaurant | `Restaurant`, `CafeOrCoffeeShop`, `FastFoodRestaurant` |
| Auto | `AutoDealer`, `AutoRepair`, `AutoBodyShop` |
| Health | `MedicalBusiness`, `Dentist`, `Pharmacy` |
| Beauty | `HealthAndBeautyBusiness`, `BeautySalon`, `HairSalon` |
| Real estate | `RealEstateAgent` |
| Hospitality | `Hotel`, `BedAndBreakfast`, `Resort` |
| Financial | `BankOrCreditUnion`, `InsuranceAgency` |

**Field guidance:**
- `@id` (rec): Unique URI per location. Reference from Product/Service to link back.
- `priceRange`: `$`, `$$`, `$$$`, `$$$$` — relative scale, not currency-specific.
- `geo`: Optional but improves Google Maps presence.
- `openingHoursSpecification`: Use multiple blocks for different days/hours.
- `parentOrganization`: Link to the main Organization schema if this is a branch.

**Common mistakes:**
- One LocalBusiness block listing multiple addresses — wrong. One block per location.
- Wrong country code (use ISO 3166-1 alpha-2: `RO`, `US`, `DE`).
- Missing `geo` when location matters for Maps ranking.

---

## Product (the danger zone)

**Use on**: Individual product detail pages only. NOT on category listings (use ItemList there).

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Real Product Name",
  "description": "Full product description text from the page.",
  "image": [
    "https://example.com/images/product-main.jpg",
    "https://example.com/images/product-side.jpg"
  ],
  "brand": {
    "@type": "Brand",
    "name": "Brand Name"
  },
  "manufacturer": {
    "@type": "Organization",
    "name": "Brand Name",
    "url": "https://example.com"
  },
  "sku": "REAL-SKU-12345",
  "mpn": "MFR-PART-NUMBER",
  "gtin13": "1234567890123",
  "category": "Doors > Metallic Doors",
  "color": "Brown",
  "material": "Steel",
  "weight": {
    "@type": "QuantitativeValue",
    "value": "45",
    "unitCode": "KGM"
  },
  "countryOfOrigin": "RO",
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/produse/product-slug",
    "priceCurrency": "RON",
    "price": "1899.00",
    "priceValidUntil": "2026-12-31",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": {
      "@type": "Organization",
      "name": "Brand Name"
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 14
    },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "0",
        "currency": "RON"
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "RO"
      }
    }
  }
}
```

**Use this for B2B / no-direct-sale catalogs** (product info without purchase):

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Real Product Name",
  "description": "Full product description.",
  "image": ["..."],
  "brand": { "@type": "Brand", "name": "Brand Name" },
  "manufacturer": { "@type": "Organization", "name": "Brand Name" },
  "sku": "REAL-SKU",
  "category": "Category Name",
  "countryOfOrigin": "RO"
}
```

Note: NO `offers` block, NO price, NO availability. Schema describes the product without claiming a purchase channel.

**Availability values:**
- `https://schema.org/InStock` — buyable now
- `https://schema.org/OutOfStock` — temporarily unavailable
- `https://schema.org/PreOrder` — coming soon
- `https://schema.org/BackOrder` — will ship when restocked
- `https://schema.org/InStoreOnly` — physical only
- `https://schema.org/Discontinued` — permanently unavailable (REMOVES from Google Shopping)

**GTIN family:**
- `gtin8` — 8-digit (mostly outside US)
- `gtin12` — UPC (US)
- `gtin13` — EAN (Europe, most common here)
- `gtin14` — multi-pack identifier

**NEVER use as gtin/sku:**
- Mongo `_id` (24-char hex)
- Internal product UUIDs
- Slugs

If no real GTIN exists, omit the field. Don't fake it.

**Reviews / AggregateRating** — only with real reviews displayed on the page:

```json
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.7",
  "reviewCount": "23",
  "bestRating": "5",
  "worstRating": "1"
},
"review": [
  {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Real Customer Name" },
    "datePublished": "2025-08-15",
    "reviewBody": "Actual review text from a verified customer.",
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "5",
      "bestRating": "5"
    }
  }
]
```

---

## Article / BlogPosting / NewsArticle

**Use on**: Blog posts, articles, news.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Article Title (max 110 chars)",
  "alternativeHeadline": "Optional alternate title",
  "description": "Meta description / article subtitle",
  "image": [
    "https://example.com/images/article-hero-1x1.jpg",
    "https://example.com/images/article-hero-4x3.jpg",
    "https://example.com/images/article-hero-16x9.jpg"
  ],
  "datePublished": "2025-08-15T09:00:00+03:00",
  "dateModified": "2025-11-20T14:30:00+02:00",
  "author": {
    "@type": "Person",
    "name": "Real Author Name",
    "url": "https://example.com/blog/autor/author-slug",
    "jobTitle": "Production Engineer",
    "worksFor": {
      "@type": "Organization",
      "name": "Brand Name"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "Brand Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/images/logo.png",
      "width": 600,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/blog/article-slug"
  },
  "articleSection": "Category",
  "keywords": "keyword1, keyword2, keyword3",
  "wordCount": 1200,
  "inLanguage": "ro"
}
```

**Article subtypes:**
- `Article` — generic
- `BlogPosting` — blog
- `NewsArticle` — news/journalism (stricter E-E-A-T)
- `TechArticle` — technical
- `Report` — research/whitepaper
- `Recipe` — cooking (different required fields)

**Field guidance:**
- `headline`: Max 110 chars for News carousel eligibility.
- `image`: Provide multiple aspect ratios for max placement options.
- `datePublished` / `dateModified`: ISO 8601 with timezone. Update `dateModified` only when content actually changes.
- `author`: MUST be a Person with a real public profile, not just an Organization. Fake authors are detectable.

---

## BreadcrumbList

**Use on**: Every page except homepage.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Acasă",
      "item": "https://example.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Uși Metalice",
      "item": "https://example.com/tipuri-de-usi/usi-metalice"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Ușă Prestige Modern"
    }
  ]
}
```

**Rules:**
- `position` starts at 1, increments by 1.
- The LAST item omits `item` (it's the current page).
- `name` matches what's visible in the page's breadcrumb component.
- URLs are absolute.

---

## FAQPage

**Use on**: Pages with visible Q&A. The schema must match displayed content.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does delivery take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard products ship in 3-5 business days. Custom orders take 10-15 business days."
      }
    },
    {
      "@type": "Question",
      "name": "What warranty do you offer?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "All products come with a 5-year warranty covering structure, mechanisms, and finishes."
      }
    }
  ]
}
```

**Note**: Since 2023, Google shows FAQ rich snippets primarily for government and well-known authoritative sites. Schema is still valuable for semantic understanding.

**Rules:**
- Questions and answers must be visible on the page (not hidden behind tabs that JS strips for crawlers).
- One FAQPage block per page. Don't duplicate.
- `acceptedAnswer.text` is plain text; HTML is allowed but minimal.

---

## HowTo

**Use on**: Step-by-step instructional content (installation guides, tutorials, recipes).

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Measure a Door Opening",
  "description": "Step-by-step guide to accurately measuring for a new door.",
  "image": "https://example.com/images/how-to-measure.jpg",
  "totalTime": "PT15M",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "RON",
    "value": "0"
  },
  "supply": [
    { "@type": "HowToSupply", "name": "Measuring tape" },
    { "@type": "HowToSupply", "name": "Notepad" }
  ],
  "tool": [
    { "@type": "HowToTool", "name": "Spirit level" }
  ],
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Measure the width",
      "text": "Measure the width of the door opening at three points: top, middle, bottom.",
      "image": "https://example.com/images/step-1.jpg",
      "url": "https://example.com/guide#step-1"
    }
  ]
}
```

**Note**: Google deprecated HowTo rich snippets for desktop in 2023. Still useful for mobile and semantic structure.

---

## VideoObject

**Use on**: Pages with primary video content.

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Product Installation Demo",
  "description": "Step-by-step installation of our metal door product.",
  "thumbnailUrl": [
    "https://example.com/images/video-thumb-1x1.jpg",
    "https://example.com/images/video-thumb-4x3.jpg",
    "https://example.com/images/video-thumb-16x9.jpg"
  ],
  "uploadDate": "2025-06-01T08:00:00+03:00",
  "duration": "PT4M32S",
  "contentUrl": "https://example.com/videos/installation.mp4",
  "embedUrl": "https://example.com/embed/installation",
  "interactionStatistic": {
    "@type": "InteractionCounter",
    "interactionType": { "@type": "WatchAction" },
    "userInteractionCount": 12453
  }
}
```

**Duration format**: ISO 8601 — `PT[hours]H[minutes]M[seconds]S`. Examples: `PT30S`, `PT5M`, `PT1H15M30S`.

---

## WebSite (with SearchAction)

**Use on**: Homepage only. Enables sitelinks search box.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Brand Name",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://example.com/cauta?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

**Critical**: The search URL must actually exist and return relevant results. Without a working search page, this schema is misleading.

---

## ItemList

**Use on**: Category pages, listing pages. Tells Google "this is a list".

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "url": "https://example.com/produse/product-1-slug"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "url": "https://example.com/produse/product-2-slug"
    }
  ]
}
```

For richer signal, you can embed Product objects (with same Product fields):

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Product",
        "name": "Product 1",
        "image": "...",
        "url": "https://example.com/produse/product-1-slug"
      }
    }
  ]
}
```

**Limit**: Top 30-50 items. Don't dump a 500-item catalog into one schema.

---

## Service

**Use on**: Service pages (consulting, repair, installation, etc.).

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Door Installation Service",
  "description": "Professional installation of metal and interior doors across Romania.",
  "provider": {
    "@type": "Organization",
    "name": "Brand Name",
    "url": "https://example.com"
  },
  "areaServed": {
    "@type": "Country",
    "name": "Romania"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Installation Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Apartment Door Installation"
        }
      }
    ]
  }
}
```

---

## Event

**Use on**: Real events with date and venue. Sales events, openings, webinars.

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Annual Doors & Windows Expo",
  "startDate": "2026-03-15T10:00:00+02:00",
  "endDate": "2026-03-17T18:00:00+02:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Romexpo",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Bulevardul Mărăști 65-67",
      "addressLocality": "București",
      "postalCode": "011465",
      "addressCountry": "RO"
    }
  },
  "image": "https://example.com/images/event.jpg",
  "description": "Annual industry expo for door and window professionals.",
  "organizer": {
    "@type": "Organization",
    "name": "Brand Name",
    "url": "https://example.com"
  }
}
```

**Rules:**
- `startDate` and `endDate`: ISO 8601 with timezone.
- `eventStatus`: `EventScheduled`, `EventCancelled`, `EventMovedOnline`, `EventPostponed`, `EventRescheduled`.
- `eventAttendanceMode`: `OnlineEventAttendanceMode`, `OfflineEventAttendanceMode`, `MixedEventAttendanceMode`.

**Remove**: Once event is past, remove the schema or update status. Stale Event schemas hurt trust.

---

## Person (author pages)

**Use on**: Blog author profile pages, team/about pages.

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Real Name",
  "givenName": "Real",
  "familyName": "Name",
  "jobTitle": "Production Engineer",
  "image": "https://example.com/images/team/real-name.jpg",
  "url": "https://example.com/blog/autor/real-name",
  "worksFor": {
    "@type": "Organization",
    "name": "Brand Name",
    "url": "https://example.com"
  },
  "sameAs": [
    "https://www.linkedin.com/in/realname"
  ],
  "knowsAbout": ["Metal doors", "Manufacturing processes", "Quality control"],
  "alumniOf": {
    "@type": "EducationalOrganization",
    "name": "University Name"
  }
}
```

**Rules:**
- Person schema for real, public-facing employees only.
- Photo must be of the actual person.
- `sameAs` links go to that person's real public profiles.

---

## CollectionPage / WebPage

**Use on**: Specialized landing pages, hubs, collections.

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "All Metal Doors",
  "url": "https://example.com/tipuri-de-usi/usi-metalice",
  "description": "Complete collection of our metal doors.",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Brand Name",
    "url": "https://example.com"
  },
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [ /* see ItemList above */ ]
  }
}
```

---

## Schema combination patterns

Common page types and recommended schemas:

| Page type | Schemas to include |
|---|---|
| Homepage | `Organization` + `WebSite` (with SearchAction) |
| Contact page | `LocalBusiness` (one per location) + `BreadcrumbList` |
| Category listing | `CollectionPage` + `ItemList` + `BreadcrumbList` |
| Product detail | `Product` (with or without `offers`) + `BreadcrumbList` |
| Blog index | `Blog` (or `WebPage`) + `BreadcrumbList` |
| Blog post | `BlogPosting` + `BreadcrumbList` + author `Person` (linked via author field) |
| About page | `AboutPage` + `Organization` (full detail) + `Person` (per team member) |
| Service page | `Service` + `BreadcrumbList` |
| FAQ page | `FAQPage` + `BreadcrumbList` |

Multiple schemas per page are fine and recommended. Each block separate, in its own `<script>` tag.

---

## Validation workflow

Before declaring a schema block done:

1. Paste raw JSON into https://validator.schema.org/ — fix all errors.
2. Run https://search.google.com/test/rich-results — confirms Google parses it.
3. After deploy, use Search Console URL Inspection to confirm Google sees it live.
4. Monitor "Enhancements" reports in Search Console for ongoing errors.

If validation shows `WARNING` (recommended field missing): consider adding, but not blocking.
If validation shows `ERROR` (required field missing): fix before shipping.
