// The genres the album hubs group picks by. Each pick's genre lives in src/data/album-genres.json.
// The names are the Sigil NMF Crate's lanes (src/lib/lanes.mjs), so scripts/publish-crate.mjs can
// copy a new pick's lane straight in. Old names from before the 2026-11-23 split still resolve.
import data from '../data/album-genres.json';
import { LANES, currentLane } from './lanes.mjs';

export interface Genre {
	name: string;
	slug: string;
}

export const GENRES: Genre[] = LANES;

/** Matching key that ignores case, curly quotes and extra spaces. */
export function albumKey(artist: string, album: string): string {
	return `${artist} - ${album}`
		.toLowerCase()
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, ' ')
		.trim();
}

const byKey = new Map<string, string>();
for (const [heading, genre] of Object.entries(data.albums as Record<string, string>)) {
	const split = heading.indexOf(' - ');
	if (split !== -1) byKey.set(albumKey(heading.slice(0, split), heading.slice(split + 3)), genre);
}

export function genreFor(artist: string, album: string): Genre | undefined {
	const name = currentLane(byKey.get(albumKey(artist, album)));
	return GENRES.find((g) => g.name === name);
}
