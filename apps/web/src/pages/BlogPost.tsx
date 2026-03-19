import { useEffect, useState, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { usePageSEO } from '../hooks/usePageSEO';
import { mdxComponents } from '../content/components';
import type { BlogPostMeta } from '@fuelripple/shared';

type PostModule = { default: React.ComponentType; frontmatter: BlogPostMeta };

// Dynamic import map for all blog posts
const POST_MODULES: Record<string, () => Promise<PostModule>> = {
  'why-gas-prices-spike-refineries': () =>
    import('../content/posts/why-gas-prices-spike-refineries.mdx') as Promise<PostModule>,
  'padd-regions-explained': () =>
    import('../content/posts/padd-regions-explained.mdx') as Promise<PostModule>,
  'rockets-and-feathers': () =>
    import('../content/posts/rockets-and-feathers.mdx') as Promise<PostModule>,
  '2022-energy-crisis-geopolitics': () =>
    import('../content/posts/2022-energy-crisis-geopolitics.mdx') as Promise<PostModule>,
  'monthly-fuel-cost-tracker': () =>
    import('../content/posts/monthly-fuel-cost-tracker.mdx') as Promise<PostModule>,
};

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 animate-pulse">
      <div className="h-10 bg-slate-700 rounded-lg w-3/4" />
      <div className="h-4 bg-slate-800 rounded w-1/2" />
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-4 bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  );
}

/**
 * Blog Post Page: Dynamically loads and renders a single blog post MDX file.
 * Sets SEO metadata from post frontmatter and wraps content in MDX styling.
 */
export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [Post, setPost] = useState<React.ComponentType | null>(null);
  const [meta, setMeta] = useState<BlogPostMeta | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      return;
    }

    const loader = POST_MODULES[slug];
    if (!loader) {
      setNotFound(true);
      return;
    }

    loader()
      .then(mod => {
        setPost(() => mod.default);
        setMeta(mod.frontmatter);
      })
      .catch(() => {
        setNotFound(true);
      });
  }, [slug]);

  usePageSEO({
    title: meta?.title ?? 'Blog Post',
    description: meta?.description ?? '',
    canonicalPath: meta?.canonicalPath ?? `/blog/${slug}`,
    type: 'article',
    publishedAt: meta?.publishedAt,
    keywords: meta?.seoKeywords,
  });

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Post Not Found</h1>
        <p className="text-slate-400">The article you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  if (!Post || !meta) {
    return <PageSkeleton />;
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      {/* Article Header */}
      <header className="mb-8 pb-8 border-b border-slate-700">
        <h1 className="text-4xl font-bold text-blue-100 mb-4">{meta.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm">
          <span>
            {new Date(meta.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span>•</span>
          <span>{meta.readingMinutes} min read</span>
          <span>•</span>
          <span>By {meta.author}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {meta.tags.map(tag => (
            <span
              key={tag}
              className="px-3 py-1 bg-slate-700 text-slate-200 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* Article Content */}
      <div className="prose prose-invert prose-slate max-w-none">
        <Suspense fallback={<PageSkeleton />}>
          <MDXProvider components={mdxComponents}>
            <Post />
          </MDXProvider>
        </Suspense>
      </div>

      {/* Article Footer */}
      <footer className="mt-12 pt-8 border-t border-slate-700">
        <div className="bg-slate-900 p-6 rounded-lg">
          <p className="text-slate-300">
            Questions or feedback? Use FuelRipple's interactive dashboard to explore price trends,
            disruption scores, and regional comparisons.
          </p>
        </div>
      </footer>
    </article>
  );
}
