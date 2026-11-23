// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://sigil.studio',
	trailingSlash: 'never',
	integrations: [mdx(), sitemap()],
	redirects: {
		'/releases': '/calendar',
		'/crate': '/albums',
		// Genre hubs renamed when the crate's lanes split (2026-11-23).
		'/genres/jazz-ambient': '/genres/jazz',
		'/genres/electronic': '/genres/electronic-dance',
	},
});
