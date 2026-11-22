// "In the news": headlines from other music sites about artists Sigil has picked or reviewed.
// The stories live in src/data/news.json, written by scripts/fetch-news.mjs. Only artists with a
// published pick or review count, so a draft review never pulls stories onto the built site.
import data from '../data/news.json';
import { getAlbumPicks } from './albums';
import { type ArtistGroup, groupByArtist, slugify } from './hubs';
import { getPosts } from './posts';

interface StoryData {
	url: string;
	title: string;
	source: string;
	date: string;
	artists: string[];
	take?: string;
	hidden?: boolean;
}

export interface NewsArtist {
	name: string;
	slug: string;
	/** The artist page when there is one, otherwise their one pick or review. */
	href?: string;
}

export interface Story {
	url: string;
	title: string;
	source: string;
	date: Date;
	take?: string;
	artists: NewsArtist[];
}

function artistLink(a: ArtistGroup): string | undefined {
	return a.href ?? a.picks[0]?.href ?? (a.reviews[0] && `/blog/${a.reviews[0].id}`);
}

let cache: Promise<Story[]> | undefined;

/** Every story about an artist on the site, newest first. */
export function getNews(): Promise<Story[]> {
	cache ??= (async () => {
		const reviews = (await getPosts()).filter((p) => p.data.projectName === 'Album Review');
		const onSite = new Map(groupByArtist(await getAlbumPicks(), reviews).map((a) => [a.slug, a]));
		return (data.items as StoryData[])
			.filter((s) => !s.hidden)
			.map((s) => ({
				url: s.url,
				title: s.title,
				source: s.source,
				date: new Date(s.date),
				take: s.take?.trim() || undefined,
				artists: s.artists
					.map((name) => onSite.get(slugify(name)))
					.filter((a): a is ArtistGroup => !!a)
					.map((a) => ({ name: a.name, slug: a.slug, href: artistLink(a) })),
			}))
			.filter((s) => s.artists.length > 0)
			.sort((a, b) => b.date.valueOf() - a.date.valueOf());
	})();
	return cache;
}

export async function newsFor(slug: string): Promise<Story[]> {
	return (await getNews()).filter((s) => s.artists.some((a) => a.slug === slug));
}
