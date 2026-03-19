import { Link } from 'react-router-dom';
import { usePageSEO } from '../hooks/usePageSEO';
import { ALL_POSTS } from '../content/index';

/**
 * Blog Index Page: Lists all published blog posts in reverse chronological order.
 */
export default function Blog() {
  usePageSEO({
    title: 'Blog',
    description:
      'Articles about gasoline prices, refinery disruptions, market correlations, and consumer impact. ' +
      'Dive into energy economics and what price volatility means for your household.',
    canonicalPath: '/blog',
    keywords: ['blog', 'articles', 'gas prices', 'energy', 'disruption index'],
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="mb-12">
        <h1 className="text-4xl font-bold mb-4 text-blue-100">FuelRipple Blog</h1>
        <p className="text-slate-300 text-lg">
          Explore articles on gasoline prices, refinery disruptions, market dynamics, and what 
          energy volatility means for your household budget.
        </p>
      </section>

      <section className="grid gap-6">
        {ALL_POSTS.map(post => (
          <article
            key={post.slug}
            className="border border-slate-700 bg-slate-800/50 hover:bg-slate-800 p-6 rounded-lg transition"
          >
            <Link to={`/blog/${post.slug}`} className="group">
              <h2 className="text-2xl font-bold text-blue-200 group-hover:text-blue-100 mb-2">
                {post.title}
              </h2>
            </Link>
            <p className="text-slate-400 text-sm mb-4">
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}{' '}
              • {post.readingMinutes} min read
            </p>
            <p className="text-slate-300 mb-4">{post.description}</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-slate-700 text-slate-200 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Link
              to={`/blog/${post.slug}`}
              className="inline-block mt-4 text-blue-400 hover:text-blue-300 font-semibold"
            >
              Read article →
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
