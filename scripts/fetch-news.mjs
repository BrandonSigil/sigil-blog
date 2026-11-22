#!/usr/bin/env node
// Scans the music news feeds in src/data/news-sources.json for stories about artists Sigil has
// picked or reviewed, and keeps them in src/data/news.json for the "In the news" lists.
//
//   node scripts/fetch-news.mjs            fetch, merge and write
//   node scripts/fetch-news.mjs --dry-run  print what would be added, write nothing
//
// A story matches when an artist's name appears in its headline, spelled and capitalised the
// same way ("&" and "and" count as the same). Stories already in the file keep their "take", so
// a hand-written take or "hidden": true is never lost. Stories older than keepDays drop out.
// Only headlines, links and source names are stored: no images or article text.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BLOG = join(ROOT, 'src/content/blog');
const SOURCES = join(ROOT, 'src/data/news-sources.json');
const OUT = join(ROOT, 'src/data/news.json');
const dryRun = process.argv.includes('--dry-run');

const config = JSON.parse(readFileSync(SOURCES, 'utf8'));
const ignore = new Set((config.ignore ?? []).map((n) => n.toLowerCase()));

// --- Artists: every "## Artist - Album" pick heading and every review's `artist:` ---
function artistsOnSigil() {
	const names = new Set();
	for (const file of readdirSync(BLOG)) {
		if (!/\.mdx?$/.test(file)) continue;
		const text = readFileSync(join(BLOG, file), 'utf8');
		const review = text.match(/^artist:\s*["']?(.+?)["']?\s*$/m);
		if (review) names.add(review[1]);
		for (const m of text.matchAll(/!\[[^\]]*\]\([^)\s]+\)\s*\n+##\s+(.+)/g)) {
			const heading = m[1].replace(/^\[(.+)\]\(.*\)$/, '$1').trim();
			const split = heading.indexOf(' - ');
			if (split > 0) names.add(heading.slice(0, split).trim());
		}
	}
	return [...names].filter((n) => n.length >= 3 && !ignore.has(n.toLowerCase()));
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function matcher(name) {
	const pattern = name
		.replace(/[’']/g, "'")
		.split(/\s+(?:&|and)\s+/i)
		.map(escape)
		.join('\\s+(?:&|and)\\s+')
		.replace(/'/g, "['’]");
	return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'u');
}

// --- RSS ---
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
	return s
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
		.replace(/\s+/g, ' ')
		.trim();
}
const tag = (xml, name) => {
	const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
	return m ? decode(m[1]) : '';
};

async function readFeed(feed) {
	const res = await fetch(feed.url, {
		headers: { 'user-agent': 'Mozilla/5.0 (compatible; SigilNews/1.0; +https://sigil.studio)' },
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const xml = await res.text();
	return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)]
		.map(([item]) => ({
			title: tag(item, 'title'),
			url: tag(item, 'link').trim(),
			date: new Date(tag(item, 'pubDate') || tag(item, 'dc:date')),
			source: feed.name,
		}))
		.filter((s) => s.title && /^https?:\/\//.test(s.url) && !Number.isNaN(s.date.valueOf()));
}

// --- Run ---
const artists = artistsOnSigil().map((name) => ({ name, re: matcher(name) }));
const existing = (() => {
	try {
		return JSON.parse(readFileSync(OUT, 'utf8')).items ?? [];
	} catch {
		return [];
	}
})();
const byUrl = new Map(existing.map((s) => [s.url, s]));
const cutoff = Date.now() - (config.keepDays ?? 60) * 86400000;

const added = [];
const failed = [];
for (const feed of config.feeds) {
	let stories;
	try {
		stories = await readFeed(feed);
	} catch (e) {
		failed.push(`${feed.name}: ${e.message}`);
		continue;
	}
	for (const s of stories) {
		if (s.date.valueOf() < cutoff) continue;
		const matched = artists.filter((a) => a.re.test(s.title)).map((a) => a.name);
		if (!matched.length) continue;
		const old = byUrl.get(s.url);
		if (old) {
			old.artists = [...new Set([...old.artists, ...matched])];
			continue;
		}
		const story = { url: s.url, title: s.title, source: s.source, date: s.date.toISOString(), artists: matched, take: '' };
		byUrl.set(s.url, story);
		added.push(story);
	}
}

const items = [...byUrl.values()]
	.filter((s) => new Date(s.date).valueOf() >= cutoff)
	.sort((a, b) => b.date.localeCompare(a.date));

for (const s of added) console.log(`+ [${s.source}] ${s.title}  (${s.artists.join(', ')})`);
for (const f of failed) console.warn(`! ${f}`);
console.log(`${artists.length} artists, ${added.length} new stories, ${items.length} kept.`);
if (failed.length === config.feeds.length) process.exit(1);

if (!dryRun) {
	const note =
		'Written by scripts/fetch-news.mjs. Add a one-line "take" to any story by hand; it is kept on later runs. Set "hidden": true to hide a story that matched the wrong artist (deleting it would let it come back while it is still in its feed); add the artist to "ignore" in news-sources.json if it keeps happening.';
	writeFileSync(OUT, JSON.stringify({ _note: note, items }, null, 2) + '\n');
}
