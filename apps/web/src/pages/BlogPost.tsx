import { useEffect, useState, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { usePageSEO } from '../hooks/usePageSEO';
import { mdxComponents } from '../content/components';
import ShareButtons from '../components/ShareButtons';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('📄 BlogPost: slug =', slug);
    
    if (!slug) {
      console.error('❌ BlogPost: slug is missing');
      setNotFound(true);
      return;
    }

    const loader = POST_MODULES[slug];
    if (!loader) {
      console.error('❌ BlogPost: slug not found in POST_MODULES:', slug);
      console.log('📍 Available slugs:', Object.keys(POST_MODULES));
      setNotFound(true);
      return;
    }

    console.log('⏳ BlogPost: loading MDX for slug:', slug);
    
    loader()
      .then(mod => {
        console.log('✅ BlogPost: MDX loaded', { hasDefault: !!mod.default, hasFrontmatter: !!mod.frontmatter });
        if (!mod.default) {
          throw new Error('No default export from MDX');
        }
        if (!mod.frontmatter) {
          console.warn('⚠️  No frontmatter found, using partial data');
        }
        setPost(() => mod.default);
        setMeta(mod.frontmatter);
        setError(null);
      })
      .catch((err) => {
        console.error('❌ BlogPost: Error loading MDX:', err);
        setError(err?.message || 'Failed to load article');
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
        {error && (
          <div className="mt-6 p-4 bg-red-950 border border-red-700 rounded">
            <p className="text-red-300 text-sm font-mono">{error}</p>
          </div>
        )}
        <div className="mt-6">
          <Link to="/blog" className="text-blue-400 hover:text-blue-300">
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  if (!Post || !meta) {
    return <PageSkeleton />;
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span className="text-xl">←</span>
          <span>Back to Blog</span>
        </Link>
      </div>

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
      <footer className="mt-12 pt-8 border-t border-slate-700 space-y-6">
        <ShareButtons
          title={meta.title}
          description={meta.description}
          url={`https://fuelripple.com/blog/${slug}`}
        />
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
