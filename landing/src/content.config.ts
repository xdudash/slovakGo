import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  // `title` is the on-page H1. The <title> tag is `seoTitle` when given, else
  // "<title> — SlovakGO"; either way it must fit in 60 characters for search.
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().max(60).optional(),
    description: z.string().max(155),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).refine(
    (post) => (post.seoTitle ?? `${post.title} — SlovakGO`).length <= 60,
    { message: 'Page title over 60 characters: add a shorter seoTitle.' },
  ),
});

export const collections = { blog };
