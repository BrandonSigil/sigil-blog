// Grouping for the album hubs: by year, month, genre and artist. Everything here is derived from
// getAlbumPicks, so the hubs grow by themselves as New Music Friday posts are published.
import type { AlbumPick } from './albums';
import { GENRES, type Genre } from './genres';
import type { Post } from './posts';

export const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export const monthSlug = (month: number) => MONTHS[month].toLowerCase();
export const monthHref = (year: number, month: number) => `/albums/${year}/${monthSlug(month)}`;

export interface MonthGroup {
	year: number;
	month: number;
	name: string;
	href: string;
	picks: AlbumPick[];
}

export interface YearGroup {
	year: number;
	href: string;
	picks: AlbumPick[];
	months: MonthGroup[];
}

/** Years newest first; inside each year, months in calendar order. */
export function groupByYear(picks: AlbumPick[]): YearGroup[] {
	const years = new Map<number, AlbumPick[]>();
	for (const p of picks) {
		const y = p.pubDate.getFullYear();
		years.set(y, [...(years.get(y) ?? []), p]);
	}
	return [...years.entries()]
		.sort(([a], [b]) => b - a)
		.map(([year, yearPicks]) => ({
			year,
			href: `/albums/${year}`,
			picks: yearPicks,
			months: MONTHS.map((name, month) => ({
				year,
				month,
				name,
				href: monthHref(year, month),
				picks: inOrder(yearPicks.filter((p) => p.pubDate.getMonth() === month)),
			})).filter((m) => m.picks.length > 0),
		}));
}

/** Oldest post first, keeping each post's own order of picks. */
function inOrder(picks: AlbumPick[]): AlbumPick[] {
	return picks
		.map((p, i) => ({ p, i }))
		.sort((a, b) => a.p.pubDate.valueOf() - b.p.pubDate.valueOf() || a.i - b.i)
		.map(({ p }) => p);
}

export interface GenreGroup extends Genre {
	href: string;
	picks: AlbumPick[];
}

/** Every genre with at least one pick, in the order GENRES lists them. */
export function groupByGenre(picks: AlbumPick[]): GenreGroup[] {
	return GENRES.map((g) => ({
		...g,
		href: `/genres/${g.slug}`,
		picks: picks.filter((p) => p.genre?.slug === g.slug),
	})).filter((g) => g.picks.length > 0);
}

export interface ArtistGroup {
	name: string;
	slug: string;
	sortKey: string;
	picks: AlbumPick[];
	reviews: Post[];
	/** Only artists with two or more entries get their own page; one entry links straight to it. */
	href?: string;
}

const sortKey = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();

export function groupByArtist(picks: AlbumPick[], reviews: Post[]): ArtistGroup[] {
	const artists = new Map<string, ArtistGroup>();
	const entry = (name: string) => {
		const slug = slugify(name);
		if (!artists.has(slug)) artists.set(slug, { name, slug, sortKey: sortKey(name), picks: [], reviews: [] });
		return artists.get(slug)!;
	};
	for (const p of picks) entry(p.artist).picks.push(p);
	for (const r of reviews) if (r.data.artist) entry(r.data.artist).reviews.push(r);
	return [...artists.values()]
		.map((a) => ({ ...a, href: a.picks.length + a.reviews.length >= 2 ? `/artists/${a.slug}` : undefined }))
		.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/** First letter for the A–Z index; digits and symbols go under "#". */
export function letterOf(a: ArtistGroup): string {
	const c = a.sortKey.normalize('NFKD').charAt(0).toUpperCase();
	return /[A-Z]/.test(c) ? c : '#';
}
