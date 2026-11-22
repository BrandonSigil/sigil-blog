import type { ImageMetadata } from 'astro';
import { render } from 'astro:content';
import { getPosts } from './posts';

// Every album recommended in a New Music Friday post, read straight from the post body.
// A pick is recognised by the pattern the posts already use:
//
//   ![Artist - Album](../../assets/folder/cover.jpg)
//
//   ## Artist - Album
//
//   _Tasting Notes: ..._        (optional)
//
// Nothing extra to fill in: write the post that way and the album shows up here.
export interface AlbumPick {
	artist: string;
	album: string;
	cover?: ImageMetadata;
	tastingNotes?: string;
	href: string; // link to the album's spot in its post
	postTitle: string;
	pubDate: Date;
}

const covers = import.meta.glob<ImageMetadata>('/src/assets/**/*.{jpg,jpeg,png,webp}', {
	eager: true,
	import: 'default',
});

const PICK = /!\[[^\]]*\]\(([^)\s]+)\)\s*\n+##\s+(.+)/g;
const TASTING = /^_Tasting Notes:\s*(.+?)_\s*$/m;

export async function getAlbumPicks(): Promise<AlbumPick[]> {
	const posts = (await getPosts()).filter((p) => p.data.projectName === 'New Music Friday');
	const picks: AlbumPick[] = [];

	for (const post of posts) {
		const body = post.body ?? '';
		const { headings } = await render(post);

		for (const match of body.matchAll(PICK)) {
			const [, src, rawHeading] = match;
			// "## [Artist - Album](https://...)" -> "Artist - Album"
			const text = rawHeading.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
			const split = text.indexOf(' - ');
			if (split === -1) continue;

			// Only look for tasting notes before the next pick starts.
			const after = body.slice(match.index + match[0].length);
			const nextPick = after.search(/\n!\[|\n##\s/);
			const tasting = (nextPick === -1 ? after : after.slice(0, nextPick)).match(TASTING);

			const slug = headings.find((h) => h.depth === 2 && h.text.trim() === text)?.slug;
			const coverKey = '/src/assets/' + src.replace(/^(\.\.\/)+assets\//, '');

			picks.push({
				artist: text.slice(0, split).trim(),
				album: text.slice(split + 3).trim(),
				cover: covers[coverKey],
				tastingNotes: tasting?.[1].trim(),
				href: `/blog/${post.id}${slug ? `#${slug}` : ''}`,
				postTitle: post.data.title,
				pubDate: post.data.pubDate,
			});
		}
	}

	return picks;
}
