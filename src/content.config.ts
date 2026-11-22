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
			draft: z.boolean().default(false),
			// Music magazine fields
			category: z.enum(['nmf', 'review', 'news', 'list', 'essay']).optional(),
			projectName: z.string().optional(), // Album name or column label (e.g. "New Music Friday", "Album Review")
			artist: z.string().optional(), // Artist or agency
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

// Case studies for /work. `template` picks the page layout:
// brand (identity systems), product (apps and platforms), site (client websites).
const work = defineCollection({
	loader: glob({ base: './src/content/work', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			client: z.string(),
			summary: z.string(),
			lede: z.string(),
			template: z.enum(['brand', 'product', 'site']),
			disciplines: z.array(z.string()),
			year: z.string(),
			role: z.string(),
			services: z.array(z.string()),
			stack: z.array(z.string()).default([]),
			url: z.string().url().optional(),
			order: z.number(),
			featured: z.boolean().default(false),
			theme: z.object({
				bg: z.string(),
				ink: z.string(),
				accent: z.string(),
			}),
			cover: image(),
			coverAlt: z.string(),
			palette: z.array(z.object({ name: z.string(), hex: z.string() })).default([]),
			typefaces: z
				.array(z.object({ family: z.string(), role: z.string(), stack: z.string().optional() }))
				.default([]),
			stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
			features: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
			gallery: z
				.array(
					z.object({
						src: image(),
						alt: z.string(),
						caption: z.string().optional(),
						size: z.enum(['full', 'wide', 'half', 'rail']).default('wide'),
						frame: z.enum(['none', 'browser', 'phone']).default('none'),
					}),
				)
				.default([]),
		}),
});

export const collections = { blog, work };
