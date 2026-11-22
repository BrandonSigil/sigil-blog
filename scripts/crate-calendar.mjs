#!/usr/bin/env node
// Copies every album in a crate export (not only the picks) into src/data/crate-scores.json, so
// the release calendar can rank albums by Brandon's fit score and count the outlets covering them.
// scripts/publish-crate.mjs calls this for both folders it is given; it can also run alone:
//
//   node scripts/crate-calendar.mjs <export folder> [<export folder> ...]
//
// Albums are keyed by artist + title, so a later export updates an earlier one. Albums released
// before the start of last month drop out. No covers or notes are copied, only the fields below.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'src/data/crate-scores.json');

const key = (a) => `${a.artist} - ${a.title}`.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

export function updateCrateScores(albums) {
	let data;
	try {
		data = JSON.parse(readFileSync(OUT, 'utf8'));
	} catch {
		data = { albums: [] };
	}
	const byKey = new Map(data.albums.map((a) => [key(a), a]));
	for (const a of albums) {
		const releaseDate = a.releaseDate ?? a.friday;
		if (!a.artist || !a.title || !releaseDate) continue;
		byKey.set(key(a), {
			artist: a.artist,
			title: a.title,
			releaseDate,
			score: typeof a.score === 'number' ? a.score : null,
			lane: a.lane ?? null,
			type: a.type ?? null,
			reissue: !!a.reissue,
			sources: Array.isArray(a.sources) ? a.sources : [],
			decision: a.decision ?? null,
			why: a.why ?? '',
		});
	}
	const now = new Date();
	const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
	const kept = [...byKey.values()]
		.filter((a) => a.releaseDate.slice(0, 7) >= from)
		.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.artist.localeCompare(b.artist));
	writeFileSync(
		OUT,
		JSON.stringify(
			{ _note: 'Written by scripts/crate-calendar.mjs (run by publish-crate.mjs) from the Sigil NMF Crate. Do not edit by hand.', albums: kept },
			null,
			'\t',
		) + '\n',
	);
	return kept.length;
}

const readFolder = (dir) =>
	readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => {
			const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
			return { id: basename(f, '.json'), ...(doc.data ?? doc) };
		});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const dirs = process.argv.slice(2);
	if (!dirs.length) {
		console.error('Usage: node scripts/crate-calendar.mjs <export folder> [<export folder> ...]');
		process.exit(1);
	}
	const albums = dirs.flatMap(readFolder);
	console.log(`Calendar: ${albums.length} crate albums read, ${updateCrateScores(albums)} in src/data/crate-scores.json.`);
}
