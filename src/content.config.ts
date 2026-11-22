import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			// Drafts are kept out of the built site.
			draft: z.boolean().default(false),
			// Music magazine fields
			category: z.enum(['nmf', 'review', 'news', 'list', 'essay']).optional(),
			projectName: z.string().optional(), // Album name or column label (e.g. "New Music Friday", "Album Review")
			artist: z.string().optional(),
			genre: z.string().optional(),
			label: z.string().optional(),
			releaseDate: z.string().optional(),
			rating: z.number().min(1).max(10).optional(),
			sigilPick: z.boolean().default(false),
			essentialTracks: z.array(z.string()).default([]),
			forFansOf: z.array(z.string()).default([]),
			listenUrl: z.string().url().optional(),
			bandcampUrl: z.string().url().optional(),
		}),
});

export const collections = { blog };
