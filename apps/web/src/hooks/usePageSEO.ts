import { useEffect } from 'react';

interface SEOOptions {
  title: string;           // Page-specific part, e.g. "Regional Price Comparison"
  description: string;
  /** Canonical path, e.g. "/comparison". Defaults to current pathname. */
  canonicalPath?: string;
  /** Page type: 'website' (default) or 'article' for blog posts */
  type?: 'website' | 'article';
  /** ISO date for articles; triggers Schema.org NewsArticle JSON-LD */
  publishedAt?: string;
  /** SEO keywords for meta tags */
  keywords?: string[];
}

const SITE_NAME  = 'FuelRipple';
const SITE_URL   = 'https://fuelripple.com';
const OG_IMAGE   = `${SITE_URL}/og-image.svg`;

function setMeta(name: string, content: string): void {
  // name= metas
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setProperty(property: string, content: string): void {
  // property= metas (Open Graph, Twitter)
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(data: Record<string, unknown>): void {
  let el = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Lightweight SEO hook for SPA route changes.
 * Updates document.title, meta description, Open Graph, Twitter Card, and canonical URL.
 * Supports both website and article types, with optional Schema.org JSON-LD for articles.
 * Does not require react-helmet — pure DOM manipulation.
 */
export function usePageSEO({
  title,
  description,
  canonicalPath,
  type = 'website',
  publishedAt,
  keywords,
}: SEOOptions): void {
  useEffect(() => {
    const fullTitle = `${SITE_NAME} — ${title}`;
    const path      = canonicalPath ?? window.location.pathname;
    const canonical = `${SITE_URL}${path}`;

    // Document title
    document.title = fullTitle;

    // Standard meta
    setMeta('description', description);
    if (keywords && keywords.length > 0) {
      setMeta('keywords', keywords.join(', '));
    }

    // Open Graph
    setProperty('og:title',       fullTitle);
    setProperty('og:description', description);
    setProperty('og:url',         canonical);
    setProperty('og:image',       OG_IMAGE);
    setProperty('og:type',        type === 'article' ? 'article' : 'website');
    setProperty('og:site_name',   SITE_NAME);

    // Article-specific Open Graph tags
    if (type === 'article' && publishedAt) {
      setProperty('article:published_time', publishedAt);
    }

    // Twitter Card
    setProperty('twitter:card',        'summary_large_image');
    setProperty('twitter:title',       fullTitle);
    setProperty('twitter:description', description);
    setProperty('twitter:image',       OG_IMAGE);
    setProperty('twitter:site',        '@FuelRipple');

    // Schema.org JSON-LD for articles
    if (type === 'article') {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        'headline': title,
        'description': description,
        'datePublished': publishedAt,
        'publisher': {
          '@type': 'Organization',
          'name': 'FuelRipple',
          'url': SITE_URL,
        },
      };
      setJsonLd(schema);
    }

    // Canonical
    setCanonical(canonical);
  }, [title, description, canonicalPath, type, publishedAt, keywords]);
}
