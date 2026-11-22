// Year in Sigil: a yearly recap built from the New Music Friday posts.
// Picks come from getAlbumPicks (src/lib/albums.ts), the same reader the album index uses,
// so a new post shows up on the next build with no extra step.
// Owner-written parts (intro, lanes, the ranked lists) live in src/data/year-in-sigil/<year>.json.
import { type AlbumPick, getAlbumPicks } from './albums';

export interface RankedAlbum {
	artist: string;
	album: string;
	note?: string;
}

export interface RankedSong {
	title: string;
	artist: string;
	note?: string;
}

export interface YearData {
	year: number;
	draft: boolean;
	intro: string;
	lanes: Record<string, string>;
	albums: RankedAlbum[];
	songs: RankedSong[];
	songCandidates: RankedSong[];
}

export interface Pick extends AlbumPick {
	key: string;
	month: number;
	lane: string;
}

export interface ListAlbum extends RankedAlbum {
	pick?: Pick;
}

export const MONTHS = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

export const CARDS = ['summary', 'months', 'lanes', 'albums', 'songs'] as const;
export type CardName = (typeof CARDS)[number];

const UNSORTED = 'Unsorted';

const dataFiles = import.meta.glob<{ default: YearData }>('/src/data/year-in-sigil/*.json', {
	eager: true,
});

/** Matching key that ignores case, curly quotes and extra spaces. */
export function pickKey(artist: string, album: string): string {
	return `${artist} - ${album}`
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Drafts build locally and on Vercel previews, never in production. */
export function showDrafts(): boolean {
	return import.meta.env.DEV || process.env.VERCEL_ENV !== 'production';
}

export function allYears(): YearData[] {
	return Object.values(dataFiles)
		.map((m) => m.default)
		.filter((d) => !d.draft || showDrafts())
		.sort((a, b) => b.year - a.year);
}

export function yearData(year: number): YearData | undefined {
	return allYears().find((d) => d.year === year);
}

export async function picksFor(data: YearData): Promise<Pick[]> {
	const lanes = new Map(Object.entries(data.lanes).map(([k, v]) => [pickKey(...splitKey(k)), v]));
	return (await getAlbumPicks())
		.filter((p) => p.pubDate.getFullYear() === data.year)
		.sort((a, b) => a.pubDate.valueOf() - b.pubDate.valueOf())
		.map((p) => {
			const key = pickKey(p.artist, p.album);
			return { ...p, key, month: p.pubDate.getMonth(), lane: lanes.get(key) ?? UNSORTED };
		});
}

function splitKey(key: string): [string, string] {
	const i = key.indexOf(' - ');
	return i === -1 ? [key, ''] : [key.slice(0, i), key.slice(i + 3)];
}

export function stats(picks: Pick[]) {
	const fridays = new Set(picks.map((p) => p.postTitle)).size;
	const artists = new Set(picks.map((p) => p.artist.toLowerCase())).size;
	const laneCounts = new Map<string, number>();
	for (const p of picks) laneCounts.set(p.lane, (laneCounts.get(p.lane) ?? 0) + 1);
	const lanes = [...laneCounts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	const byMonth = MONTHS.map((name, month) => ({
		name,
		month,
		picks: picks.filter((p) => p.month === month),
	})).filter((m) => m.picks.length > 0);
	return { picks: picks.length, fridays, artists, lanes, byMonth };
}

/** The ranked top 10 once it exists, else every pick in order as candidates. */
export function albumList(data: YearData, picks: Pick[]): { ranked: boolean; items: ListAlbum[] } {
	const byKey = new Map(picks.map((p) => [p.key, p]));
	if (data.albums.length > 0) {
		return {
			ranked: true,
			items: data.albums.slice(0, 10).map((a) => ({ ...a, pick: byKey.get(pickKey(a.artist, a.album)) })),
		};
	}
	return { ranked: false, items: picks.map((p) => ({ artist: p.artist, album: p.album, pick: p })) };
}

export function songList(data: YearData): { ranked: boolean; items: RankedSong[] } {
	return data.songs.length > 0
		? { ranked: true, items: data.songs.slice(0, 10) }
		: { ranked: false, items: data.songCandidates };
}
