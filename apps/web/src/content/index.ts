import { BlogPostMeta } from '@fuelripple/shared';

// Import all post frontmatter as local values
import { frontmatter as whyGasPricesSpikeRefineries } from './posts/why-gas-prices-spike-refineries.mdx';
import { frontmatter as paddRegionsExplained } from './posts/padd-regions-explained.mdx';
import { frontmatter as rocketsAndFeathers } from './posts/rockets-and-feathers.mdx';
import { frontmatter as energyCrisisGeopolitics } from './posts/2022-energy-crisis-geopolitics.mdx';
import { frontmatter as monthlyFuelCostTracker } from './posts/monthly-fuel-cost-tracker.mdx';

// Re-export for direct use elsewhere
export {
  whyGasPricesSpikeRefineries,
  paddRegionsExplained,
  rocketsAndFeathers,
  energyCrisisGeopolitics,
  monthlyFuelCostTracker,
};

// Aggregate all posts in reverse chronological order
export const ALL_POSTS: BlogPostMeta[] = [
  whyGasPricesSpikeRefineries,
  paddRegionsExplained,
  rocketsAndFeathers,
  energyCrisisGeopolitics,
  monthlyFuelCostTracker,
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

// Quick lookup map by slug
export const POST_BY_SLUG: Record<string, BlogPostMeta> = Object.fromEntries(
  ALL_POSTS.map(post => [post.slug, post])
);
