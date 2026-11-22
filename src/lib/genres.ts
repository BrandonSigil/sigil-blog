// The genres the album hubs group picks by. Each pick's genre lives in src/data/album-genres.json.
// The names match the Sigil NMF Crate's lanes, so scripts/publish-crate.mjs can copy a new pick's
// lane straight in. The crate has no "Rock" or "Electronic" lane yet; those are set by hand.
import data from '../data/album-genres.json';

export interface Genre {
	name: string;
	slug: string;
}

export const GENRES: Genre[] = [
	{ name: 'Indie & folk', slug: 'indie-folk' },
	{ name: 'Rock', slug: 'rock' },
	{ name: 'Soul & funk', slug: 'soul-funk' },
	{ name: 'Hip-hop', slug: 'hip-hop' },
	{ name: 'Jazz & ambient', slug: 'jazz-ambient' },
	{ name: 'Electronic', slug: 'electronic' },
	{ name: 'Pop', slug: 'pop' },
	{ name: 'Country & roots', slug: 'country-roots' },
];

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
	const name = byKey.get(albumKey(artist, album));
	return GENRES.find((g) => g.name === name);
}
