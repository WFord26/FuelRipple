import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/historical', priority: '0.8', changefreq: 'daily' },
  { path: '/comparison', priority: '0.8', changefreq: 'weekly' },
  { path: '/supply', priority: '0.8', changefreq: 'daily' },
  { path: '/impact', priority: '0.7', changefreq: 'weekly' },
  { path: '/correlation', priority: '0.7', changefreq: 'weekly' },
  { path: '/downstream', priority: '0.6', changefreq: 'monthly' },
  { path: '/blog', priority: '0.6', changefreq: 'weekly' },
];

interface FrontmatterMeta {
  slug: string;
  publishedAt: string;
  updatedAt?: string;
}

/**
 * Parses YAML frontmatter from an MDX file using regex.
 * Avoids importing MDX at config-load time (no MDX loader available then).
 */
function parseFrontmatter(filePath: string): FrontmatterMeta | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Handle both LF and CRLF line endings
    const normalised = content.replace(/\r\n/g, '\n');
    const match = normalised.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yaml = match[1];
    const get = (key: string) => {
      const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };

    const slug = get('slug');
    const publishedAt = get('publishedAt');
    if (!slug || !publishedAt) return null;

    return { slug, publishedAt, updatedAt: get('updatedAt') };
  } catch {
    return null;
  }
}

/**
 * Vite plugin to generate sitemap.xml at build time.
 * Reads blog post frontmatter directly from MDX source files — no MDX import needed.
 */
export function sitemapPlugin(): Plugin {
  return {
    name: 'vite-fuelripple-sitemap',
    closeBundle() {
      const BASE = 'https://www.fuelripple.com';
      const today = new Date().toISOString().split('T')[0];

      // Read frontmatter from MDX files at bundle-close time (Node.js context)
      const postsDir = path.resolve(__dirname, 'src/content/posts');
      const mdxFiles = fs.existsSync(postsDir)
        ? fs.readdirSync(postsDir).filter(f => f.endsWith('.mdx'))
        : [];

      const blogPosts = mdxFiles
        .map(f => parseFrontmatter(path.join(postsDir, f)))
        .filter((p): p is FrontmatterMeta => p !== null)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

      const staticEntries = STATIC_ROUTES.map(
        r => `
  <url>
    <loc>${BASE}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
      ).join('');

      const blogEntries = blogPosts.map(
        p => `
  <url>
    <loc>${BASE}/blog/${p.slug}</loc>
    <lastmod>${p.updatedAt ?? p.publishedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
      ).join('');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${blogEntries}
</urlset>`;

      const distPath = path.resolve(__dirname, 'dist', 'sitemap.xml');
      fs.mkdirSync(path.dirname(distPath), { recursive: true });
      fs.writeFileSync(distPath, xml);
      console.log(
        `[sitemap] Generated with ${STATIC_ROUTES.length + blogPosts.length} URLs`
      );
    },
  };
}
