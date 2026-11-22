// Album covers for the release calendar, in src/assets/calendar/<id>.jpg (id from looseKey, the
// same key src/lib/calendar.ts uses). Two ways in:
//   - the crate's own covers (scripts/crate-calendar.mjs), which win over any lookup
//   - a search of Deezer, then Apple's iTunes catalogue, for everything else
//     (scripts/fetch-releases.mjs). Both are public and need no key.
// src/data/calendar-covers.json records each album's result, so a found cover is never looked up
// again and a miss is retried after a week (pre-release albums often get their art late).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { looseKey } from '../../src/lib/calendar-core.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const COVER_DIR = join(ROOT, 'src/assets/calendar');
const CACHE = join(ROOT, 'src/data/calendar-covers.json');
const UA = 'Mozilla/5.0 (compatible; SigilCalendar/1.0)';
const RETRY_DAYS = 7;

export const coverId = (artist, title) => looseKey(artist, title).replace('|', '-').slice(0, 120);

export function readCache() {
	try {
		return JSON.parse(readFileSync(CACHE, 'utf8')).albums ?? {};
	} catch {
		return {};
	}
}

export function writeCache(cache) {
	const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(
		CACHE,
		JSON.stringify({ _note: 'Written by the calendar scripts: where each cover came from, or when it was last looked for.', albums: sorted }, null, '\t') +
			'\n',
	);
}

/** Saves a cover as a small JPEG. Shrinks it with sharp when that's installed, else as is. */
export async function saveCover(id, bytes) {
	mkdirSync(COVER_DIR, { recursive: true });
	let out = bytes;
	try {
		const { default: sharp } = await import('sharp');
		out = await sharp(bytes).resize(240, 240, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
	} catch {
		// No sharp (the daily GitHub Action skips installing packages): the lookups already ask for
		// small covers, so the original is fine.
	}
	writeFileSync(join(COVER_DIR, `${id}.jpg`), out);
}

/** Removes covers of albums no longer on the calendar. */
export function pruneCovers(keepIds, cache) {
	if (!existsSync(COVER_DIR)) return 0;
	let removed = 0;
	for (const file of readdirSync(COVER_DIR)) {
		const id = file.replace(/\.jpg$/, '');
		if (!keepIds.has(id)) {
			rmSync(join(COVER_DIR, file));
			removed++;
		}
	}
	for (const id of Object.keys(cache)) if (!keepIds.has(id)) delete cache[id];
	return removed;
}

export function needsLookup(id, cache, today = new Date()) {
	const entry = cache[id];
	if (!entry) return true;
	if (entry.status === 'found') return !existsSync(join(COVER_DIR, `${id}.jpg`));
	return (today.valueOf() - new Date(entry.tried).valueOf()) / 86400000 >= RETRY_DAYS;
}

// --- Lookup ------------------------------------------------------------------------------

const norm = (s) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/\((?:deluxe|expanded|explicit|clean)[^)]*\)|\[[^\]]*\]/g, '')
		.replace(/^the\s+/, '')
		.replace(/[^a-z0-9]+/g, '');

function matches(want, gotArtist, gotTitle) {
	const wa = norm(want.artist);
	const first = norm(want.artist.split(/\s+(?:&|and|x|with|feat\.?)\s+|,\s*/i)[0]);
	const ga = norm(gotArtist);
	const artistOk = ga === wa || ga === first || (first.length >= 4 && (ga.includes(first) || wa.includes(ga)));
	const wt = norm(want.title);
	const gt = norm(gotTitle);
	const titleOk = wt.length > 0 && (gt === wt || (Math.min(wt.length, gt.length) >= 4 && (gt.startsWith(wt) || wt.startsWith(gt))));
	return artistOk && titleOk;
}

async function getJson(url) {
	const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function getBytes(url) {
	const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

async function fromDeezer(album) {
	const q = encodeURIComponent(`artist:"${album.artist.split(/\s+(?:&|and|x|with)\s+|,\s*/i)[0]}" album:"${album.title}"`);
	const data = await getJson(`https://api.deezer.com/search/album?q=${q}&limit=10`);
	const hit = (data.data ?? []).find((d) => matches(album, d.artist?.name ?? '', d.title ?? ''));
	return hit?.cover_medium ? { url: hit.cover_medium, source: 'deezer' } : null;
}

async function fromItunes(album) {
	const term = encodeURIComponent(`${album.artist} ${album.title}`);
	const data = await getJson(`https://itunes.apple.com/search?media=music&entity=album&limit=10&term=${term}`);
	const hit = (data.results ?? []).find((r) => matches(album, r.artistName ?? '', r.collectionName ?? ''));
	return hit?.artworkUrl100 ? { url: hit.artworkUrl100.replace('100x100bb', '250x250bb'), source: 'itunes' } : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Looks up covers for the given albums (each { artist, title }), at most `limit` lookups, and
 * records every result in the cache. Returns { found, missed }.
 */
export async function lookupCovers(albums, cache, { limit = Infinity, log = () => {} } = {}) {
	const today = new Date();
	let found = 0;
	let missed = 0;
	let tries = 0;
	for (const album of albums) {
		const id = coverId(album.artist, album.title);
		if (!needsLookup(id, cache, today)) continue;
		if (tries++ >= limit) break;
		let hit = null;
		for (const source of [fromDeezer, fromItunes]) {
			try {
				hit = await source(album);
			} catch (e) {
				log(`  ${source.name} failed for ${album.artist} - ${album.title}: ${e.message}`);
			}
			await sleep(source === fromItunes ? 3200 : 150); // iTunes allows about 20 searches a minute
			if (hit) break;
		}
		const tried = today.toISOString().slice(0, 10);
		if (hit) {
			try {
				await saveCover(id, await getBytes(hit.url));
				cache[id] = { status: 'found', source: hit.source, tried };
				found++;
				continue;
			} catch (e) {
				log(`  download failed for ${album.artist} - ${album.title}: ${e.message}`);
			}
		}
		cache[id] = { status: 'missing', tried };
		missed++;
	}
	return { found, missed };
}
