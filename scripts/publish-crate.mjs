#!/usr/bin/env node
// Publishes the Sigil NMF Crate to the site.
//
//   node scripts/publish-crate.mjs <week folder> [--draft] [--ahead <coming-up folder>]
//   node scripts/publish-crate.mjs --ahead <coming-up folder>
//
// Each folder is an export of one crate collection, one JSON file per album (Claude makes it by
// reading the crate's database; see "Publishing the crate" in agent.md):
//   week folder        `weeks/<friday>/albums`, the week being reviewed
//   coming-up folder   `weeks/ahead/albums`, albums announced for later that Brandon has flagged
//
// It writes:
//   src/data/upcoming.json        the week's approved and favorited albums ("Upcoming albums" block)
//   src/assets/upcoming/*.jpg     their covers
//   src/data/releases.json        every pick and every flagged album with its release date; the
//                                 homepage's "Out this month" and "Anticipated" lists read this
//   src/assets/releases/*.jpg     their covers
// and with --draft, if that week's post does not exist yet:
//   src/content/blog/nmf-<friday>.md   a draft New Music Friday post with the picks laid out
//   src/assets/nmf-<friday>/*.jpg      covers for the post
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const wantDraft = args.includes('--draft');
const aheadAt = args.indexOf('--ahead');
const aheadDir = aheadAt >= 0 ? args[aheadAt + 1] : null;
const exportDir = args.find((a, i) => !a.startsWith('--') && (aheadAt < 0 || i !== aheadAt + 1)) ?? null;

const usage = () => {
	console.error('Usage: node scripts/publish-crate.mjs <week folder> [--draft] [--ahead <coming-up folder>]');
	process.exit(1);
};
if (!exportDir && !aheadDir) usage();
for (const dir of [exportDir, aheadDir]) if (dir && !existsSync(dir)) usage();

const readAlbums = (dir) =>
	readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => ({ id: basename(f, '.json'), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
const flagged = (a) => a.decision === 'favorite' || a.decision === 'approved';

// Favorites first, then approved, each by fit score.
const rank = (a) => (a.decision === 'favorite' ? 0 : 1);
const albums = exportDir ? readAlbums(exportDir) : [];
const picks = albums.filter(flagged).sort((a, b) => rank(a) - rank(b) || (b.score ?? 0) - (a.score ?? 0));

if (exportDir && picks.length === 0) {
	console.error(`No approved or favorited albums among the ${albums.length} in ${exportDir}. Nothing written.`);
	process.exit(1);
}

const friday = picks[0]?.friday;
if (exportDir && !/^\d{4}-\d{2}-\d{2}$/.test(friday ?? '')) {
	console.error('Could not read the release Friday from the albums. Nothing written.');
	process.exit(1);
}

// Covers are stored in the crate as base64 JPEG/PNG data.
function coverBytes(album) {
	const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/s.exec(album.cover ?? '');
	return m ? { ext: m[1] === 'jpeg' ? 'jpg' : m[1], bytes: Buffer.from(m[2], 'base64') } : null;
}
const httpsOnly = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : null);

// --- Release calendar: "Out this month" and "Anticipated" ---
// One running list of everything picked or flagged, kept between runs. Albums drop off two
// months after release; a flagged album that is un-flagged before it comes out drops off too.
{
	const file = join(root, 'src/data/releases.json');
	const thumbs = join(root, 'src/assets/releases');
	mkdirSync(thumbs, { recursive: true });
	const today = new Date().toISOString().slice(0, 10);
	// "2027-01" (month known, day not) sorts and compares as the end of that month.
	const sortable = (date) => (date.length === 7 ? `${date}-31` : date);
	const artistOnly = (a) =>
		`https://open.spotify.com/search/${encodeURIComponent(a.artist.split(/ & | and |, | feat\.? | with /i)[0].trim())}`;

	const entry = (a, source) => {
		const releaseDate = a.releaseDate || a.friday;
		if (!/^\d{4}-\d{2}(-\d{2})?$/.test(releaseDate ?? '')) return null;
		const cover = coverBytes(a);
		const coverFile = cover ? `${a.id}.${cover.ext}` : null;
		if (cover) writeFileSync(join(thumbs, coverFile), cover.bytes);
		return {
			id: a.id,
			artist: a.artist,
			title: a.title,
			releaseDate,
			genre: a.lane ?? null,
			type: a.type ?? null,
			source,
			cover: coverFile,
			// An album search finds nothing before release day, so point at the artist until then.
			listen: sortable(releaseDate) > today ? artistOnly(a) : httpsOnly(a.links?.spotify),
		};
	};

	const kept = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).albums : [];
	const byId = new Map(kept.map((a) => [a.id, a]));

	if (aheadDir) {
		const ahead = readAlbums(aheadDir).filter(flagged);
		const still = new Set(ahead.map((a) => a.id));
		for (const a of kept) {
			if (a.source === 'ahead' && sortable(a.releaseDate) > today && !still.has(a.id)) byId.delete(a.id);
		}
		for (const a of ahead) {
			const e = entry(a, 'ahead');
			if (e && byId.get(a.id)?.source !== 'week') byId.set(a.id, e);
		}
	}
	for (const a of picks) {
		const e = entry(a, 'week');
		if (e) byId.set(a.id, e);
	}

	const cutoff = new Date(Date.now() - 62 * 86400000).toISOString().slice(0, 10);
	const list = [...byId.values()]
		.filter((a) => sortable(a.releaseDate) >= cutoff)
		.sort((a, b) => sortable(a.releaseDate).localeCompare(sortable(b.releaseDate)) || a.artist.localeCompare(b.artist));
	const inUse = new Set(list.map((a) => a.cover).filter(Boolean));
	for (const f of readdirSync(thumbs)) if (!inUse.has(f)) rmSync(join(thumbs, f));

	mkdirSync(join(root, 'src/data'), { recursive: true });
	writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), albums: list }, null, '\t') + '\n');
	const coming = list.filter((a) => sortable(a.releaseDate) > today).length;
	console.log(`Release calendar: ${list.length} albums in src/data/releases.json (${coming} still to come)`);
}

if (!exportDir) process.exit(0);

// --- Upcoming albums block ---
const coverDir = join(root, 'src/assets/upcoming');
rmSync(coverDir, { recursive: true, force: true });
mkdirSync(coverDir, { recursive: true });

const upcoming = {
	friday,
	publishedAt: new Date().toISOString(),
	albums: picks.map((a) => {
		const cover = coverBytes(a);
		const file = cover ? `${a.id}.${cover.ext}` : null;
		if (cover) writeFileSync(join(coverDir, file), cover.bytes);
		return {
			id: a.id,
			artist: a.artist,
			title: a.title,
			releaseDate: a.releaseDate || friday,
			genre: a.lane ?? null,
			type: a.type ?? null,
			label: a.label || null,
			favorite: a.decision === 'favorite',
			cover: file,
			listen: httpsOnly(a.links?.spotify),
		};
	}),
};
mkdirSync(join(root, 'src/data'), { recursive: true });
writeFileSync(join(root, 'src/data/upcoming.json'), JSON.stringify(upcoming, null, '\t') + '\n');
console.log(`Upcoming albums: ${picks.length} picks for ${friday} written to src/data/upcoming.json`);

// --- Draft post ---
if (wantDraft) {
	const postPath = join(root, `src/content/blog/nmf-${friday}.md`);
	if (existsSync(postPath)) {
		console.log(`Draft skipped: ${postPath} already exists.`);
	} else {
		const [y, m, d] = friday.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const month = date.toLocaleDateString('en-US', { month: 'long' });
		const ordinal = d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
		const postAssets = join(root, `src/assets/nmf-${friday}`);
		mkdirSync(postAssets, { recursive: true });

		const sections = picks.map((a) => {
			const cover = coverBytes(a);
			const heading = `${a.artist} - ${a.title}`;
			let image = '';
			if (cover) {
				writeFileSync(join(postAssets, `${a.id}.${cover.ext}`), cover.bytes);
				image = `![${heading}](../../assets/nmf-${friday}/${a.id}.${cover.ext})\n\n`;
			}
			return `${image}## ${heading}\n\n_Tasting Notes: _\n\nWrite-up goes here.\n`;
		});

		const post = [
			'---',
			`title: "Favorite Albums from ${month} ${ordinal}, ${y}"`,
			'description: ""',
			`pubDate: "${month} ${d}, ${y}"`,
			'projectName: "New Music Friday"',
			'draft: true',
			'---',
			'',
			sections.join('\n---\n\n'),
		].join('\n');
		writeFileSync(postPath, post);
		console.log(`Draft post written to src/content/blog/nmf-${friday}.md (draft: true)`);
	}
}
