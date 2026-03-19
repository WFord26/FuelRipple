# FuelRipple — Content Layer, Sitemap & robots.txt Architecture

**Document:** `docs/CONTENT.md`
> **Status:** Planned | **Version:** 1.0 | **Date:** March 2026 | **Author:** Will Ford

---

# 1. Overview

FuelRipple's SEO keyword targets (§13.1 of `ARCHITECTURE.md`) require content that ranks on long-tail queries like "why do gas prices spike when refineries go down" and "rockets and feathers gas pricing." The interactive dashboard alone won't rank for these because they are informational queries answered by articles, not tools.

This document covers three things:
1. A blog/content layer added to the existing React app (no CMS, no separate service)
2. Dynamic `sitemap.xml` generation
3. `robots.txt`

No new infrastructure is needed. Content is stored as MDX files committed to the repository, rendered at build time by Vite, and served as static HTML.

---

# 2. Content Architecture Decision: MDX in Repo

**Choice: MDX files in `apps/web/src/content/` + Vite MDX plugin**

This was selected over headless CMS options (Contentful, Sanity, Ghost) because:
- Zero new services or API keys
- Content is version-controlled alongside the code that references it
- No webhook-triggered rebuilds needed — content ships with the next code deploy
- MDX allows embedding live React components (live price charts, the fuel calculator) directly inside article prose

The tradeoff is that non-developer content edits require a GitHub PR. This is acceptable for the current team size.

```bash
npm install --save-dev @mdx-js/rollup @mdx-js/react remark-frontmatter remark-mdx-frontmatter
```

### 2.1 Vite Config Update

```typescript
// apps/web/vite.config.ts
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
    })},
    react(),
  ],
});
```

---

# 3. Content Directory Structure

```
apps/web/src/content/
├── index.ts                          # Blog index — imports all post metadata
├── posts/
│   ├── why-gas-prices-spike-refineries.mdx
│   ├── padd-regions-explained.mdx
│   ├── rockets-and-feathers.mdx
│   ├── 2022-energy-crisis-geopolitics.mdx
│   └── monthly-fuel-cost-tracker.mdx
└── components/
    ├── LivePriceInline.tsx           # Inline live price (reuses API client)
    ├── DisruptionCallout.tsx         # Current disruption score callout box
    └── ArticleFuelCalculator.tsx     # Embedded calculator (subset of Impact page)
```

### 3.1 MDX Frontmatter Schema

```typescript
// packages/shared/src/schemas.ts — add BlogPostMeta
export const BlogPostMetaSchema = z.object({
  slug:          z.string(),
  title:         z.string(),
  description:   z.string(),
  publishedAt:   z.string(),         // ISO date string
  updatedAt:     z.string().optional(),
  author:        z.string().default('FuelRipple'),
  tags:          z.array(z.string()),
  seoKeywords:   z.array(z.string()),
  canonicalPath: z.string(),         // e.g. /blog/padd-regions-explained
  readingMinutes: z.number(),
  featuredImage: z.string().optional(),
});

export type BlogPostMeta = z.infer<typeof BlogPostMetaSchema>;
```

### 3.2 Example Post Frontmatter

```mdx
---
slug: rockets-and-feathers
title: "Rockets and Feathers: Why Gas Prices Rise Fast but Fall Slow"
description: "An FTC study found pump prices rise more than four times faster than they fall after crude oil moves. Here's why, and what it means for your wallet."
publishedAt: "2026-04-01"
author: FuelRipple
tags: [pricing, economics, crude-oil]
seoKeywords: [rockets and feathers gas prices, gas price asymmetry, why gas prices fall slowly]
canonicalPath: /blog/rockets-and-feathers
readingMinutes: 6
---

## What Is the Rockets-and-Feathers Effect?

When crude oil prices jump, gas prices at the pump follow within a week or two — like a rocket.
When crude falls, pump prices drift down over 4–8 weeks — like a feather.

<DisruptionCallout />

This asymmetry has been documented by the FTC...
```

---

# 4. Routing

Blog posts are served at `/blog/:slug`. The blog index is at `/blog`. Both are lazy-loaded React routes added to `App.tsx`.

```typescript
// apps/web/src/App.tsx — add to <Routes>
const Blog     = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));

<Route path="blog"      element={<ErrorBoundary section="Blog"><Suspense fallback={<PageSkeleton />}><Blog /></Suspense></ErrorBoundary>} />
<Route path="blog/:slug" element={<ErrorBoundary section="Blog Post"><Suspense fallback={<PageSkeleton />}><BlogPost /></Suspense></ErrorBoundary>} />
```

### 4.1 Blog Index Page (`apps/web/src/pages/Blog.tsx`)

Imports all post metadata from `content/index.ts` and renders a card grid. No API calls — pure static data from the MDX imports.

```typescript
// apps/web/src/content/index.ts
export { frontmatter as rocketsFeathersMeta } from './posts/rockets-and-feathers.mdx';
export { frontmatter as paddRegionsMeta      } from './posts/padd-regions-explained.mdx';
// ... one export per post

export const ALL_POSTS: BlogPostMeta[] = [
  rocketsFeathersMeta,
  paddRegionsMeta,
  // ...
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
```

### 4.2 Blog Post Page (`apps/web/src/pages/BlogPost.tsx`)

Dynamically imports the MDX file matching the `:slug` param. Sets per-post SEO via `usePageSEO`. Wraps MDX content in a `<MDXProvider>` that maps standard HTML elements to styled versions and makes the article components available.

```typescript
// apps/web/src/pages/BlogPost.tsx
import { useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { usePageSEO } from '../hooks/usePageSEO';
import { mdxComponents } from '../content/components';

const POST_MODULES: Record<string, () => Promise<{ default: React.ComponentType; frontmatter: BlogPostMeta }>> = {
  'rockets-and-feathers':            () => import('../content/posts/rockets-and-feathers.mdx'),
  'padd-regions-explained':          () => import('../content/posts/padd-regions-explained.mdx'),
  'why-gas-prices-spike-refineries': () => import('../content/posts/why-gas-prices-spike-refineries.mdx'),
  '2022-energy-crisis-geopolitics':  () => import('../content/posts/2022-energy-crisis-geopolitics.mdx'),
  'monthly-fuel-cost-tracker':       () => import('../content/posts/monthly-fuel-cost-tracker.mdx'),
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [Post, setPost] = useState<React.ComponentType | null>(null);
  const [meta, setMeta] = useState<BlogPostMeta | null>(null);

  useEffect(() => {
    const loader = POST_MODULES[slug ?? ''];
    if (!loader) { /* navigate to 404 */ return; }
    loader().then(mod => {
      setPost(() => mod.default);
      setMeta(mod.frontmatter);
    });
  }, [slug]);

  usePageSEO({
    title: meta?.title ?? '',
    description: meta?.description ?? '',
    canonicalPath: meta?.canonicalPath ?? `/blog/${slug}`,
    type: 'article',
    publishedAt: meta?.publishedAt,
  });

  if (!Post || !meta) return <PageSkeleton />;

  return (
    <article className="prose prose-invert prose-slate max-w-3xl mx-auto">
      <MDXProvider components={mdxComponents}>
        <Post />
      </MDXProvider>
    </article>
  );
}
```

---

# 5. Planned Posts (Initial Set)

These five posts cover all Tier 2 and Tier 3 SEO keywords from `ARCHITECTURE.md §13.1.1`.

| **File**                                    | **Primary Keyword Target**                              | **Linked Dashboard View**        |
|---------------------------------------------|---------------------------------------------------------|----------------------------------|
| `why-gas-prices-spike-refineries.mdx`       | "refinery outages gas prices", "supply disruption"      | /supply                          |
| `padd-regions-explained.mdx`                | "PADD regions", "why is West Coast gas more expensive"  | /comparison                      |
| `rockets-and-feathers.mdx`                  | "gas price asymmetry", "rockets and feathers pricing"   | /correlation                     |
| `2022-energy-crisis-geopolitics.mdx`        | "oil price geopolitics", "2022 energy crisis"           | /historical                      |
| `monthly-fuel-cost-tracker.mdx`             | "fuel cost index", "monthly gas price tracker"          | /impact                          |

Each post ends with a CTA section containing:
- A live data component (current price, disruption score, or supply status)
- A link to the relevant dashboard view
- The alert subscribe widget

---

# 6. `sitemap.xml`

`sitemap.xml` is generated at build time by a Vite plugin that reads the post metadata and static routes. It is output as a static file at `apps/web/public/sitemap.xml` and served by Azure Front Door with no rewriting needed.

### 6.1 Vite Sitemap Plugin

```typescript
// apps/web/vite-sitemap-plugin.ts
import type { Plugin } from 'vite';
import { ALL_POSTS } from './src/content/index';

const STATIC_ROUTES = [
  { path: '/',            priority: '1.0', changefreq: 'daily'   },
  { path: '/historical',  priority: '0.8', changefreq: 'daily'   },
  { path: '/comparison',  priority: '0.8', changefreq: 'weekly'  },
  { path: '/supply',      priority: '0.8', changefreq: 'daily'   },
  { path: '/impact',      priority: '0.7', changefreq: 'weekly'  },
  { path: '/correlation', priority: '0.7', changefreq: 'weekly'  },
  { path: '/downstream',  priority: '0.6', changefreq: 'monthly' },
  { path: '/blog',        priority: '0.6', changefreq: 'weekly'  },
];

export function sitemapPlugin(): Plugin {
  return {
    name: 'vite-fuelripple-sitemap',
    closeBundle() {
      const BASE = 'https://www.fuelripple.com';
      const today = new Date().toISOString().split('T')[0];

      const staticEntries = STATIC_ROUTES.map(r => `
  <url>
    <loc>${BASE}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('');

      const blogEntries = ALL_POSTS.map(p => `
  <url>
    <loc>${BASE}/blog/${p.slug}</loc>
    <lastmod>${p.updatedAt ?? p.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${blogEntries}
</urlset>`;

      require('fs').writeFileSync('dist/sitemap.xml', xml);
      console.log(`[sitemap] Generated with ${STATIC_ROUTES.length + ALL_POSTS.length} URLs`);
    },
  };
}
```

```typescript
// apps/web/vite.config.ts — add to plugins array
import { sitemapPlugin } from './vite-sitemap-plugin';

plugins: [
  { enforce: 'pre', ...mdx({ ... }) },
  react(),
  sitemapPlugin(),  // add here
],
```

---

# 7. `robots.txt`

Served as a static file at `apps/web/public/robots.txt`. No build-time generation needed — it is static.

```
# apps/web/public/robots.txt

User-agent: *
Allow: /

# Block API endpoints from indexing
Disallow: /api/
Disallow: /embed/        # Embed iframe pages — not useful as standalone search results
Disallow: /health

# Block query-string variants that would create duplicate content
Disallow: /*?utm_*
Disallow: /*?theme=*
Disallow: /*?region=*&*  # Allow /comparison?region=R50 but not multi-param combos

Sitemap: https://www.fuelripple.com/sitemap.xml
```

---

# 8. `usePageSEO` Hook — Updates Needed

The existing `usePageSEO` hook sets `<title>` and `<meta description>` but needs two additions for blog posts:

```typescript
// apps/web/src/hooks/usePageSEO.ts — extend existing hook

interface PageSEOOptions {
  title:         string;
  description:   string;
  canonicalPath: string;
  type?:         'website' | 'article';  // NEW
  publishedAt?:  string;                 // NEW — ISO date, for article schema
  keywords?:     string[];               // NEW — per-post keyword list
}

// Add to the useEffect body:
if (options.type === 'article') {
  setMeta('og:type', 'article');
  if (options.publishedAt) setMeta('article:published_time', options.publishedAt);

  // Schema.org NewsArticle for blog posts
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': options.title,
    'description': options.description,
    'datePublished': options.publishedAt,
    'publisher': { '@type': 'Organization', 'name': 'FuelRipple', 'url': 'https://www.fuelripple.com' },
  };
  setJsonLd(schema);
}
```

---

# 9. Monorepo Placement

| **File**                                                   | **Purpose**                                          |
|------------------------------------------------------------|------------------------------------------------------|
| `apps/web/src/content/index.ts`                            | Post registry — imports all frontmatter              |
| `apps/web/src/content/posts/*.mdx`                         | Article content (5 initial posts)                    |
| `apps/web/src/content/components/LivePriceInline.tsx`      | Inline live price component for MDX                  |
| `apps/web/src/content/components/DisruptionCallout.tsx`    | Live disruption score callout for MDX                |
| `apps/web/src/content/components/ArticleFuelCalculator.tsx`| Embedded calculator for MDX                          |
| `apps/web/src/pages/Blog.tsx`                              | Blog index page                                      |
| `apps/web/src/pages/BlogPost.tsx`                          | Individual post renderer                             |
| `apps/web/src/hooks/usePageSEO.ts`                         | Extend with `type`, `publishedAt`, `keywords` fields |
| `apps/web/vite-sitemap-plugin.ts`                          | Build-time sitemap generator                         |
| `apps/web/public/robots.txt`                               | Static robots.txt (new file)                         |
| `packages/shared/src/schemas.ts`                           | `BlogPostMetaSchema` Zod definition (append)         |

---

# 10. Key Decisions

| **Decision**                  | **Choice**                               | **Rationale**                                                                              |
|-------------------------------|------------------------------------------|--------------------------------------------------------------------------------------------|
| Content storage               | MDX files in repo                        | No new services; version-controlled; supports embedded live components                    |
| No headless CMS               | MDX + Git                                | Team size doesn't justify CMS overhead; deploy cadence is weekly anyway                    |
| Sitemap generation            | Vite plugin at build time                | Static output, no server-side rendering needed, works with existing Azure static web host  |
| robots.txt                    | Static file in `public/`                 | Never needs to be dynamic; simplest possible implementation                                |
| Blog route structure          | `/blog/:slug` in existing React app      | No subdomain, no separate deployment; blog benefits from main site's domain authority      |
| Live components in articles   | MDXProvider + existing API client        | Differentiates FuelRipple articles from static content farms; reinforces brand             |