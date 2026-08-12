# Next.js SEO Implementation Patterns

Code patterns from the project for implementing SEO in a Next.js Pages Router application.

## Project Configuration

### site.config.js

The project's central configuration for site metadata:

```js
module.exports = {
  siteName: 'Site Name',
  description: 'Site description',
  baseUrl: `${process.env.APP_BASE_URL}`,
  languages: ['en', 'ro'],
  // ...
};
```

Import via `@site.config` alias.

## SEO Components

### Per-Page SEO (next-seo)

```jsx
import { NextSeo } from 'next-seo';
import config from '@site.config';

<NextSeo
  title="Page Title"
  description="Page description for search engines, under 160 characters"
  canonical={`${config.baseUrl}/page-path`}
  openGraph={{
    title: 'Page Title',
    description: 'Social sharing description',
    url: `${config.baseUrl}/page-path`,
    type: 'website',
    images: [{
      url: `${config.baseUrl}/images/og-image.jpg`,
      width: 1200,
      height: 630,
      alt: 'Image description',
    }],
  }}
/>
```

### Dynamic Page SEO (from data)

For pages like `/blog/[slug].js`:

```jsx
const BlogPost = ({ article }) => (
  <>
    <NextSeo
      title={article.seoTitle || article.title}
      description={article.metaDescription || article.subtitle || ''}
      canonical={`${config.baseUrl}/blog/${article.slug}`}
      openGraph={{
        type: 'article',
        title: article.seoTitle || article.title,
        description: article.metaDescription || article.subtitle || '',
        url: `${config.baseUrl}/blog/${article.slug}`,
        images: article.featuredImage
          ? [{ url: article.featuredImage.medium?.path || article.featuredImage.original?.path }]
          : [],
        article: {
          publishedTime: article.publishedAt,
          modifiedTime: article.updatedAt,
        },
      }}
    />
    {/* Article content */}
  </>
);
```

### Product Page SEO

For pages like `/produse/[slug].js`:

```jsx
const ProductPage = ({ product }) => (
  <>
    <NextSeo
      title={product.seo?.metaTitle || `${product.name} | ${config.siteName}`}
      description={product.seo?.metaDescription || product.description?.slice(0, 155)}
      canonical={`${config.baseUrl}/produse/${product.slug}`}
      openGraph={{
        type: 'product',
        title: product.name,
        description: product.description,
        images: product.images?.map(img => ({ url: img.medium?.path })) || [],
      }}
    />
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.images?.map(img => img.original?.path),
      brand: { '@type': 'Brand', name: config.siteName },
      manufacturer: { '@type': 'Organization', name: config.siteName, url: config.baseUrl },
      ...(product.sku && { sku: product.sku }),
      // Only include offers if real price exists. Omit entirely for B2B catalogs.
      ...(product.price && {
        offers: {
          '@type': 'Offer',
          price: String(product.price),
          priceCurrency: 'RON',
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: `${config.baseUrl}/produse/${product.slug}`,
          seller: { '@type': 'Organization', name: config.siteName },
        },
      }),
    }} />
  </>
);
```

**Forbidden patterns** (each one a Search Console warning or spam policy risk):

- `price: '0.00'` with `priceCurrency: 'RON'` and `availability: 'InStock'` — invalid pricing
- `availability: 'https://schema.org/Discontinued'` on active products — Google removes from Shopping, de-prioritizes rich snippets
- `gtin: product._id` — Mongo IDs are NOT valid GTINs (8/12/13/14 digits with checksum)
- `sku: product._id` — Mongo IDs are NOT SKUs; if no real SKU exists, omit the field
- `aggregateRating: { ratingValue: '4.8', reviewCount: '102' }` hardcoded with no real reviews — spam policy violation

**For B2B catalogs / sites that don't sell directly online**: omit `offers` entirely. The schema then describes the product without claiming a purchase channel.

See `references/anti-patterns.md` for full anti-pattern catalog with detection grep commands.

## SEO Model Fields

### Yup Schema for SEO Fields

Add to any entity model that needs SEO customization:

```js
import * as Yup from 'yup';

// Add these to your Yup.object().shape({...})
seoTitle: Yup.string(),
metaDescription: Yup.string(),
slug: Yup.string()
  .required('Slug is required')
  .matches(/^[a-z0-9_-]+$/, 'Only lowercase, numbers, hyphens, underscores')
  .min(2, 'At least 2 characters')
  .max(100, 'Max 100 characters'),

// Add to initialValues
seoTitle: '',
metaDescription: '',
slug: '',
```

### SEO Form Fields

```jsx
import { Input, Textarea, SlugInput } from '@components/Fields';
import { Field } from '@components/HookForm';

{/* In your form component */}
<SlugInput sourceField="title" placeholder="url-slug" required />
<Field as={Input} name="seoTitle" label="SEO Title" placeholder="Custom title for search engines (optional)" />
<Field as={Textarea} name="metaDescription" label="Meta Description" placeholder="Description for search engines, max 160 characters (optional)" rows={3} />
```

The `SlugInput` component auto-generates a URL-friendly slug from the `sourceField` value using the `useSlugGenerator` hook.

## Structured Data (JSON-LD)

### Reusable JsonLd Component

```jsx
import Head from 'next/head';

const JsonLd = ({ data }) => (
  <Head>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  </Head>
);

export default JsonLd;
```

### Organization Schema (homepage)

```jsx
<JsonLd data={{
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: config.siteName,
  url: config.baseUrl,
  logo: `${config.baseUrl}/images/logo.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+40-XXX-XXX-XXX',
    contactType: 'customer service',
  },
}} />
```

### Article Schema (blog posts)

```jsx
<JsonLd data={{
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.title,
  description: article.metaDescription || article.subtitle,
  image: article.featuredImage?.original?.path,
  datePublished: article.publishedAt,
  dateModified: article.updatedAt,
  author: { '@type': 'Organization', name: config.siteName },
  publisher: {
    '@type': 'Organization',
    name: config.siteName,
    logo: { '@type': 'ImageObject', url: `${config.baseUrl}/images/logo.png` },
  },
}} />
```

### BreadcrumbList Schema

```jsx
<JsonLd data={{
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: config.baseUrl },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${config.baseUrl}/blog` },
    { '@type': 'ListItem', position: 3, name: article.title },
  ],
}} />
```

## Sitemap Configuration

### next-sitemap.config.js

```js
module.exports = {
  siteUrl: `${process.env.APP_BASE_URL}`,
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: [
    '/admin/*',
    '/login',
    '/signup',
    '/forgot',
    '/reset/*',
    '/confirm/*',
    '/maintenance',
    '/thank-you',
    '/404',
    '/500',
  ],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/admin', '/api'] },
    ],
  },
};
```

Add `"postbuild": "next-sitemap"` to `package.json` scripts.

## Key Import Paths

| What | Import From |
|------|------------|
| NextSeo, DefaultSeo | `next-seo` |
| Head | `next/head` |
| config (baseUrl, siteName) | `@site.config` |
| SlugInput | `@components/Fields` |
| Field, HookForm | `@components/HookForm` |
| useSlugGenerator | `@hooks` |
