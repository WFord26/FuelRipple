import { useEffect } from 'react';

interface SEOOptions {
  title: string;           // Page-specific part, e.g. "Regional Price Comparison"
  description: string;
  /** Canonical path, e.g. "/comparison". Defaults to current pathname. */
  canonicalPath?: string;
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

/**
 * Lightweight SEO hook for SPA route changes.
 * Updates document.title, meta description, Open Graph, Twitter Card, and canonical URL.
 * Does not require react-helmet — pure DOM manipulation.
 */
export function usePageSEO({ title, description, canonicalPath }: SEOOptions): void {
  useEffect(() => {
    const fullTitle = `${SITE_NAME} — ${title}`;
    const path      = canonicalPath ?? window.location.pathname;
    const canonical = `${SITE_URL}${path}`;

    // Document title
    document.title = fullTitle;

    // Standard meta
    setMeta('description', description);

    // Open Graph
    setProperty('og:title',       fullTitle);
    setProperty('og:description', description);
    setProperty('og:url',         canonical);
    setProperty('og:image',       OG_IMAGE);
    setProperty('og:type',        'website');
    setProperty('og:site_name',   SITE_NAME);

    // Twitter Card
    setProperty('twitter:card',        'summary_large_image');
    setProperty('twitter:title',       fullTitle);
    setProperty('twitter:description', description);
    setProperty('twitter:image',       OG_IMAGE);
    setProperty('twitter:site',        '@FuelRipple');

    // Canonical
    setCanonical(canonical);
  }, [title, description, canonicalPath]);
}
