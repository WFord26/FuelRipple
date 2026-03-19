/// <reference types="vite/client" />

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { BlogPostMeta } from '@fuelripple/shared';

  export const frontmatter: BlogPostMeta;
  const MDXComponent: ComponentType;
  export default MDXComponent;
}
