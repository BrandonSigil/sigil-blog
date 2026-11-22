#!/usr/bin/env node
// Keeps the release calendar's outside data up to date. Two parts:
//
// 1. Wikipedia: reads "List of <year> albums" for this year and next (the year pages are split in
//    halves once they get long) and writes every album from the start of last month onward to
//    src/data/calendar-wiki.json: date, artist, album, genre, label, and the outlets cited for it.
// 2. Press: scans the news feeds in src/data/news-sources.json for headlines that name a
//    calendar artist, and keeps them in src/data/calendar-press.json (60 days). The number of
//    headlines is part of an album's buzz, which picks the monthly "hot releases" list.
//
// 3. Covers: looks up a cover for each album that has none yet (Deezer, then iTunes), this month
//    and next first, at most 120 lookups a run (see scripts/lib/covers.mjs), and removes covers
//    of albums that have left the calendar.
//
//   node scripts/fetch-releases.mjs              fetch and write everything
//   node scripts/fetch-releases.mjs --covers 500  allow more cover lookups this run ("all" for no cap)
//   node scripts/fetch-releases.mjs --dry-run    print counts, write nothing, look up no covers
//
// Kept: facts (dates, names, labels), headline counts and small cover thumbnails. No article text.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverId, lookupCovers, pruneCovers, readCache, writeCache } from './lib/covers.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const WIKI_OUT = join(ROOT, 'src/data/calendar-wiki.json');
const PRESS_OUT = join(ROOT, 'src/data/calendar-press.json');
const CRATE = join(ROOT, 'src/data/crate-scores.json');
const SOURCES = join(ROOT, 'src/data/news-sources.json');
const dryRun = process.argv.includes('--dry-run');
const UA = 'Mozilla/5.0 (compatible; SigilCalendar/1.0)';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');
const readJson = (path, fallback) => {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return fallback;
	}
};

// --- Wikipedia ---------------------------------------------------------------------------

async function wikitext(page) {
	const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&page=${encodeURIComponent(page)}`;
	const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
	if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
	const data = await res.json();
	if (data.error) return '';
	return data.parse.wikitext;
}

/** The year's list, or both halves when the year page is only an index of them. */
async function yearText(year) {
	const whole = await wikitext(`List of ${year} albums`);
	if (whole.length > 5000) return whole;
	const halves = await Promise.all([
		wikitext(`List of ${year} albums (January–June)`),
		wikitext(`List of ${year} albums (July–December)`),
	]);
	return halves.join('\n');
}

/** Wiki markup to plain text: links, italics, templates, tags. */
function plain(s) {
	return s
		.replace(/<ref[^>]*\/>/g, '')
		.replace(/<ref[\s\S]*?<\/ref>/g, '')
		.replace(/<br\s*\/?>/gi, ', ')
		.replace(/\{\{(?:nowrap|nobr|small)\|([^{}]*)\}\}/gi, '$1')
		.replace(/\{\{[^{}]*\}\}/g, '')
		.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
		.replace(/\[https?:\S+ ([^\]]*)\]/g, '$1')
		.replace(/'{2,}/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.replace(/^[,\s]+|[,\s]+$/g, '')
		.trim();
}

/** The outlets cited for a row ("work=" or "website=" in its references). */
function outlets(cell) {
	const found = new Set();
	for (const m of cell.matchAll(/\|\s*(?:work|website|publisher|newspaper|magazine)\s*=\s*([^|}]+)/g)) {
		const name = plain(m[1]);
		if (name) found.add(name);
	}
	return [...found];
}

/** A cell's content, without any `attr="…" |` prefix. */
function cellText(line) {
	const body = line.replace(/^\|/, '');
	const bar = body.indexOf('|');
	if (bar > -1 && !body.slice(0, bar).includes('[[') && !body.slice(0, bar).includes('{{') && /=/.test(body.slice(0, bar))) {
		return body.slice(bar + 1);
	}
	return body;
}

function parseYear(text, year) {
	const albums = [];
	const sections = text.split(/\n===\s*/);
	for (const section of sections) {
		const month = MONTHS.findIndex((m) => section.startsWith(m));
		if (month === -1) continue;
		const table = section.slice(section.indexOf('{|'), section.indexOf('\n|}') + 1);
		let day = 0;
		for (const row of table.split(/\n\|-[^\n]*/)) {
			const lines = row.split('\n').filter((l) => l.trim());
			const cells = [];
			for (const line of lines) {
				if (line.startsWith('!')) {
					// The date header: "December<br>4" (rowspan covers the rows that share it).
					if (/scope="col"/.test(line)) continue;
					const m = plain(line.replace(/^!.*?\|(?=[^|]*$)/, '')).match(/(\d{1,2})\s*$/);
					day = m ? Number(m[1]) : 0;
				} else if (line.startsWith('|') && !/^\|[+}]/.test(line)) {
					for (const part of line.split('||')) cells.push(cellText(part.startsWith('|') ? part : `|${part}`));
				} else if (cells.length) {
					cells[cells.length - 1] += `\n${line}`; // a cell that runs over several lines
				}
			}
			if (cells.length < 2) continue;
			const [artist, album, genre = '', label = '', ...rest] = cells;
			const a = plain(artist);
			const t = plain(album);
			if (!a || !t || /colspan/.test(artist)) continue;
			albums.push({
				artist: a,
				title: t,
				releaseDate: day ? `${year}-${pad(month + 1)}-${pad(day)}` : `${year}-${pad(month + 1)}`,
				genre: plain(genre),
				label: plain(label),
				outlets: outlets(cells.join('\n') + rest.join('\n')),
			});
		}
	}
	return albums;
}

// --- Press -------------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
	s
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
		.replace(/\s+/g, ' ')
		.trim();
const tag = (xml, name) => {
	const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
	return m ? decode(m[1]) : '';
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function headlines(feed) {
	const res = await fetch(feed.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const xml = await res.text();
	return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([item]) => ({
		title: tag(item, 'title'),
		url: tag(item, 'link').trim(),
		date: new Date(tag(item, 'pubDate') || tag(item, 'dc:date')),
		source: feed.name,
	}));
}

// --- Run ---------------------------------------------------------------------------------

const now = new Date();
const from = `${now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()}-${pad(((now.getUTCMonth() + 11) % 12) + 1)}`;
const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
if (now.getUTCMonth() === 0) years.unshift(now.getUTCFullYear() - 1);

const wiki = [];
for (const year of years) {
	try {
		const found = parseYear(await yearText(year), year);
		console.log(`Wikipedia ${year}: ${found.length} albums`);
		wiki.push(...found);
	} catch (e) {
		console.warn(`! Wikipedia ${year}: ${e.message}`);
	}
}
const albums = wiki
	.filter((a) => a.releaseDate.slice(0, 7) >= from)
	.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.artist.localeCompare(b.artist));
console.log(`${albums.length} albums from ${from} on.`);

// Artists to look for in headlines: everyone on the calendar, from Wikipedia and the crate.
const config = readJson(SOURCES, { feeds: [], ignore: [] });
const ignore = new Set((config.ignore ?? []).map((n) => n.toLowerCase()));
const crate = readJson(CRATE, { albums: [] }).albums;
const names = [...new Set([...albums, ...crate].flatMap((a) => a.artist.split(/\s+(?:&|and|x|with|feat\.?)\s+|,\s*/i)))]
	.map((n) => n.trim())
	.filter((n) => n.length >= 4 && !ignore.has(n.toLowerCase()));
// Headlines are title-cased, so a one-word name ("Down", "Blondie") only counts at the start of
// the headline or alongside one of that artist's album titles; longer names count anywhere.
const titlesBy = new Map();
for (const a of [...albums, ...crate]) {
	for (const n of a.artist.split(/\s+(?:&|and|x|with|feat\.?)\s+|,\s*/i)) {
		const key = n.trim();
		if (!titlesBy.has(key)) titlesBy.set(key, []);
		if (a.title.length >= 4) titlesBy.get(key).push(a.title);
	}
}
const word = (s) => `(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`;
const matchers = names.map((n) => {
	const anywhere = new RegExp(word(n), 'u');
	if (/\s/.test(n)) return { name: n, test: (t) => anywhere.test(t) };
	const start = new RegExp(`^${escape(n)}(?![\\p{L}\\p{N}])`, 'u');
	const titles = (titlesBy.get(n) ?? []).map((t) => t.toLowerCase());
	return { name: n, test: (t) => start.test(t) || (anywhere.test(t) && titles.some((x) => t.toLowerCase().includes(x))) };
});

const press = readJson(PRESS_OUT, { stories: {} }).stories;
const cutoff = Date.now() - 60 * 86400000;
let fresh = 0;
for (const feed of config.feeds) {
	try {
		for (const h of await headlines(feed)) {
			if (!h.title || Number.isNaN(h.date.valueOf()) || h.date.valueOf() < cutoff || press[h.url]) continue;
			const artists = matchers.filter((m) => m.test(h.title)).map((m) => m.name);
			if (!artists.length) continue;
			press[h.url] = { date: h.date.toISOString().slice(0, 10), source: h.source, artists };
			fresh++;
		}
	} catch (e) {
		console.warn(`! ${feed.name}: ${e.message}`);
	}
}
for (const [url, s] of Object.entries(press)) if (new Date(s.date).valueOf() < cutoff) delete press[url];
console.log(`Press: ${fresh} new headlines, ${Object.keys(press).length} kept.`);

if (!dryRun) {
	if (albums.length) {
		writeFileSync(
			WIKI_OUT,
			JSON.stringify({ _note: 'Written by scripts/fetch-releases.mjs from Wikipedia\'s "List of <year> albums". Do not edit by hand.', albums }, null, '\t') + '\n',
		);
	}
	const sorted = Object.fromEntries(Object.entries(press).sort((a, b) => b[1].date.localeCompare(a[1].date) || a[0].localeCompare(b[0])));
	writeFileSync(PRESS_OUT, JSON.stringify({ _note: 'Written by scripts/fetch-releases.mjs. Headlines naming calendar artists, for buzz.', stories: sorted }, null, '\t') + '\n');
}

// --- Covers ------------------------------------------------------------------------------
if (!dryRun) {
	const at = process.argv.indexOf('--covers');
	const raw = at > -1 ? process.argv[at + 1] : '120';
	const limit = raw === 'all' ? Infinity : Number(raw) || 120;
	const cache = readCache();
	const all = [...albums, ...crate.filter((c) => c.releaseDate.slice(0, 7) >= from)];
	const keep = new Set(all.map((a) => coverId(a.artist, a.title)));
	const removed = pruneCovers(keep, cache);
	// This month and next first, then later months, then last month.
	const thisMonth = now.toISOString().slice(0, 7);
	const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
	const order = (a) => {
		const m = a.releaseDate.slice(0, 7);
		return m < thisMonth ? 2 : m <= nextMonth ? 0 : 1;
	};
	const queue = [...all].sort((a, b) => order(a) - order(b) || a.releaseDate.localeCompare(b.releaseDate));
	const { found, missed } = await lookupCovers(queue, cache, { limit, log: (m) => console.warn(m) });
	writeCache(cache);
	const have = Object.values(cache).filter((c) => c.status === 'found').length;
	console.log(`Covers: ${found} found, ${missed} not found yet, ${removed} removed; ${have} of ${keep.size} albums have one.`);
}
