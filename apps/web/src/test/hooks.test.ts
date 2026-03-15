import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from './test-utils';
import { usePageSEO } from '../hooks/usePageSEO';

describe('usePageSEO', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
    // Clean up added meta tags
    document.querySelectorAll('meta[property^="og:"], meta[property^="twitter:"], meta[name="description"]').forEach(el => el.remove());
    document.querySelector('link[rel="canonical"]')?.remove();
  });

  it('sets document title with site name prefix', () => {
    renderHook(() => usePageSEO({
      title: 'Dashboard',
      description: 'US gasoline price dashboard',
    }));

    expect(document.title).toBe('FuelRipple — Dashboard');
  });

  it('sets meta description', () => {
    renderHook(() => usePageSEO({
      title: 'Historical',
      description: 'Historical gas price data',
    }));

    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('Historical gas price data');
  });

  it('sets Open Graph tags', () => {
    renderHook(() => usePageSEO({
      title: 'Impact',
      description: 'Consumer impact calculator',
    }));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    expect(ogTitle?.getAttribute('content')).toBe('FuelRipple — Impact');

    const ogDesc = document.querySelector('meta[property="og:description"]');
    expect(ogDesc?.getAttribute('content')).toBe('Consumer impact calculator');

    const ogType = document.querySelector('meta[property="og:type"]');
    expect(ogType?.getAttribute('content')).toBe('website');
  });

  it('sets Twitter Card tags', () => {
    renderHook(() => usePageSEO({
      title: 'Correlation',
      description: 'Crude-gas correlation analysis',
    }));

    const twitterCard = document.querySelector('meta[property="twitter:card"]');
    expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');

    const twitterSite = document.querySelector('meta[property="twitter:site"]');
    expect(twitterSite?.getAttribute('content')).toBe('@FuelRipple');
  });

  it('sets canonical URL using canonicalPath', () => {
    renderHook(() => usePageSEO({
      title: 'Comparison',
      description: 'Regional comparison',
      canonicalPath: '/comparison',
    }));

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://fuelripple.com/comparison');
  });

  it('updates tags when props change', () => {
    const { rerender } = renderHook(
      ({ title, description }) => usePageSEO({ title, description }),
      { initialProps: { title: 'Page A', description: 'Desc A' } }
    );

    expect(document.title).toBe('FuelRipple — Page A');

    rerender({ title: 'Page B', description: 'Desc B' });

    expect(document.title).toBe('FuelRipple — Page B');
    const meta = document.querySelector('meta[name="description"]');
    expect(meta?.getAttribute('content')).toBe('Desc B');
  });
});
