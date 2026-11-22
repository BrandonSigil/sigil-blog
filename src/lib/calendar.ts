// The release calendar for the site: Wikipedia's album lists plus the Sigil NMF Crate, each album
// scored for Brandon's taste and for buzz. The logic is in calendar-core.mjs (shared with the
// monthly "hot releases" draft script); this file feeds it the site's own history and covers.
import type { ImageMetadata } from 'astro';
import crate from '../data/crate-scores.json';
import press from '../data/calendar-press.json';
import releases from '../data/releases.json';
import wiki from '../data/calendar-wiki.json';
import genres from '../data/album-genres.json';
import { getAlbumPicks } from './albums';
import { buildCalendar, byTaste, hotList, looseKey, monthKey } from './calendar-core.mjs';
import { getPosts } from './posts';

export interface CalendarAlbum {
	id: string;
	artist: string;
	title: string;
	releaseDate: string; // YYYY-MM-DD, or YYYY-MM when only the month is known
	month: string; // YYYY-MM
	hasDay: boolean;
	label: string | null;
	lane: string | null;
	type: string | null;
	reissue: boolean;
	score: number;
	estimated: boolean;
	rank: number;
	buzz: number;
	pressCount: number;
	outlets: string[];
	why: string;
	onSigil: boolean;
	picked: boolean;
	inCrate: boolean;
	cover?: ImageMetadata;
	listen: string;
	dateLabel: string; // "Dec 4" or "Dec"
}

const releaseCovers = import.meta.glob<ImageMetadata>('/src/assets/releases/*.{jpg,jpeg,png,webp}', {
	eager: true,
	import: 'default',
});

let cache: Promise<CalendarAlbum[]> | undefined;

export function getCalendar(): Promise<CalendarAlbum[]> {
	cache ??= (async () => {
		const picks = await getAlbumPicks();
		const reviews = (await getPosts()).filter((p) => p.data.projectName === 'Album Review');
		const laneCounts: Record<string, number> = {};
		for (const lane of Object.values(genres.albums as Record<string, string>)) laneCounts[lane] = (laneCounts[lane] ?? 0) + 1;

		const covers = new Map<string, ImageMetadata>();
		for (const r of releases.albums) {
			const img = r.cover ? releaseCovers[`/src/assets/releases/${r.cover}`] : undefined;
			if (img) covers.set(looseKey(r.artist, r.title), img);
		}
		for (const p of picks) if (p.cover) covers.set(looseKey(p.artist, p.album), p.cover);

		const albums = buildCalendar({
			wiki: wiki.albums,
			crate: crate.albums,
			press: press.stories,
			history: {
				artists: [...picks.map((p) => p.artist), ...reviews.flatMap((r) => (r.data.artist ? [r.data.artist] : []))],
				picks: picks.map((p) => `${p.artist} - ${p.album}`),
				laneCounts,
			},
		}) as Omit<CalendarAlbum, 'cover' | 'listen' | 'dateLabel'>[];

		return albums.map((a) => {
			const [y, m, d] = a.releaseDate.split('-').map(Number);
			return {
				...a,
				cover: covers.get(looseKey(a.artist, a.title)),
				listen: `https://open.spotify.com/search/${encodeURIComponent(`${a.artist} ${a.title}`)}`,
				dateLabel: new Date(y, m - 1, d || 1).toLocaleDateString('en-US', d ? { month: 'short', day: 'numeric' } : { month: 'short' }),
			};
		});
	})();
	return cache;
}

export const monthName = (month: string) => {
	const [y, m] = month.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const monthId = (month: string) => `m-${month}`;

/** This month and next, so a page built near the end of a month is still right after it turns. */
export function currentMonths(now = new Date()): [string, string] {
	return [monthKey(now), monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))];
}

export { byTaste, hotList };
