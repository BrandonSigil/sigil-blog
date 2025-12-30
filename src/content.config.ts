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
			// Music blog fields
			projectName: z.string().optional(), // Album name or general project name
			artist: z.string().optional(), // Artist or agency
			genre: z.string().optional(),
			releaseDate: z.string().optional(),
			rating: z.number().min(1).max(10).optional(),
		}),
});

export const collections = { blog };
