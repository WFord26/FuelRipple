import { MDXComponents } from 'mdx/types';
import { LivePriceInline } from './LivePriceInline';
import { DisruptionCallout } from './DisruptionCallout';
import { ArticleFuelCalculator } from './ArticleFuelCalculator';
import { ArticleChart, ArticleTable, ArticleCallout } from './ArticleChart';

/**
 * MDX component shadowing: Maps standard HTML elements and custom components
 * for use within MDX article content.
 */
export const mdxComponents: MDXComponents = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-4xl font-bold mb-6 text-blue-100 mt-8">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-bold mb-4 text-blue-200 mt-6">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold mb-3 text-blue-300 mt-4">{children}</h3>
  ),

  // Paragraphs and text
  p: ({ children }) => (
    <p className="text-slate-300 leading-relaxed mb-4">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-4 space-y-2 text-slate-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-4 space-y-2 text-slate-300">{children}</ol>
  ),
  li: ({ children }) => <li className="text-slate-300">{children}</li>,

  // Block elements
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 bg-blue-950 pl-4 py-2 my-4 italic text-slate-300">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    // Inline code
    if (!className) {
      return (
        <code className="bg-slate-800 px-2 py-1 rounded font-mono text-yellow-200 text-sm">
          {children}
        </code>
      );
    }
    // Code block — handled by pre
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-slate-950 border border-slate-700 rounded p-4 overflow-x-auto my-4">
      {children}
    </pre>
  ),

  // Links
  a: ({ href, children }) => (
    <a href={href} className="text-blue-400 hover:text-blue-300 underline">
      {children}
    </a>
  ),

  // Tables
  table: ({ children }) => (
    <table className="w-full border-collapse my-4 text-slate-300">{children}</table>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-800 border-b border-slate-700">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-slate-700 hover:bg-slate-800/50">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left font-semibold text-blue-300">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-2">{children}</td>,

  // Custom article components
  LivePriceInline,
  DisruptionCallout,
  ArticleFuelCalculator,
  ArticleChart,
  ArticleTable,
  ArticleCallout,
};
