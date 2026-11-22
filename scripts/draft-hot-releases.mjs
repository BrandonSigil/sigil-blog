#!/usr/bin/env node
// Drafts the monthly "hot releases" post: the month's 10 most talked-about new albums, from the
// release calendar's buzz (outlets announcing it + headlines naming the artist). Brandon writes
// the takes and publishes it by deleting `draft: true`.
//
//   node scripts/draft-hot-releases.mjs            from the 25th on, drafts next month's post
//   node scripts/draft-hot-releases.mjs 2026-12    drafts that month's post now
//
// Safe to run every day (the daily .github/workflows/releases.yml does): it rewrites the draft
// only while it is untouched (still a draft, intro and every take still the placeholder), so the
// list keeps up with new press until Brandon starts editing, and never after.
// Writes src/content/blog/hot-releases-<yyyy-mm>.md.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCalendar, hotList } from '../src/lib/calendar-core.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const BLOG = join(ROOT, 'src/content/blog');
const COUNT = 10;
const MIN_BUZZ = 2; // at least two signals (outlets or headlines) to count as buzzing
const INTRO = 'Write an intro here.';
const TAKE = 'Write your take here.';
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const arg = process.argv[2];
let month;
if (arg) {
	if (!/^\d{4}-\d{2}$/.test(arg)) {
		console.error('Usage: node scripts/draft-hot-releases.mjs [YYYY-MM]');
		process.exit(1);
	}
	month = arg;
} else {
	const now = new Date();
	if (now.getUTCDate() < 25) {
		console.log('Hot releases: drafts are made from the 25th. Nothing to do.');
		process.exit(0);
	}
	const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
	month = next.toISOString().slice(0, 7);
}

const path = join(BLOG, `hot-releases-${month}.md`);
if (existsSync(path)) {
	const text = readFileSync(path, 'utf8');
	const headings = (text.match(/^## /gm) ?? []).length;
	const untouched = /^draft:\s*true\s*$/m.test(text) && text.includes(INTRO) && text.split(TAKE).length - 1 === headings;
	if (!untouched) {
		console.log(`Hot releases: ${path.replace(ROOT, '')} has been edited. Not touched.`);
		process.exit(0);
	}
}

// Sigil's history, from published posts only: NMF pick headings and review artists.
const artists = [];
const picks = [];
for (const file of readdirSync(BLOG)) {
	if (!/\.mdx?$/.test(file)) continue;
	const text = readFileSync(join(BLOG, file), 'utf8');
	if (/^draft:\s*true\s*$/m.test(text)) continue;
	const review = text.match(/^artist:\s*["']?(.+?)["']?\s*$/m);
	if (review) artists.push(review[1]);
	for (const m of text.matchAll(/!\[[^\]]*\]\([^)\s]+\)\s*\n+##\s+(.+)/g)) {
		const heading = m[1].replace(/^\[(.+)\]\(.*\)$/, '$1').trim();
		const i = heading.indexOf(' - ');
		if (i > 0) {
			artists.push(heading.slice(0, i));
			picks.push(heading);
		}
	}
}
const laneCounts = {};
for (const lane of Object.values(readJson('src/data/album-genres.json').albums)) laneCounts[lane] = (laneCounts[lane] ?? 0) + 1;

const calendar = buildCalendar({
	wiki: readJson('src/data/calendar-wiki.json').albums,
	crate: readJson('src/data/crate-scores.json').albums,
	press: readJson('src/data/calendar-press.json').stories,
	history: { artists, picks, laneCounts },
});
const hot = hotList(calendar, month, 1000).filter((a) => a.buzz >= MIN_BUZZ).slice(0, COUNT);
if (hot.length < 3) {
	console.error(`Hot releases: only ${hot.length} albums known for ${month} so far. No draft written.`);
	process.exit(0);
}

const [y, m] = month.split('-').map(Number);
const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateLabel = (a) => {
	const [yy, mm, dd] = a.releaseDate.split('-').map(Number);
	return dd ? new Date(Date.UTC(yy, mm - 1, dd)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Date TBA';
};
const list = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const q = (s) => s.replace(/"/g, '\\"');

const blocks = hot.map((a) => {
	const facts = [`**Out ${dateLabel(a)}**`, a.label, a.lane].filter(Boolean).join(' · ');
	const outlets = a.outlets.slice(0, 4);
	const buzz = [
		outlets.length && `covered by ${list(outlets)}${a.outlets.length > 4 ? ` and ${a.outlets.length - 4} more` : ''}`,
		a.pressCount && `${a.pressCount} headline${a.pressCount === 1 ? '' : 's'} naming ${a.artist} lately`,
	].filter(Boolean);
	return [
		`## ${a.artist} - ${a.title}`,
		'',
		facts,
		'',
		...(buzz.length ? [`_Why it's buzzing: ${buzz.join('; ')}._`, ''] : []),
		...(a.why ? [`<!-- Crate note: ${a.why.replace(/--/g, '–')} -->`, ''] : []),
		TAKE,
	].join('\n');
});

const post = `---
title: "The ${hot.length} hottest releases of ${monthName}"
description: "The most talked-about new albums out in ${monthName}, and what to expect from each."
pubDate: ${month}-01
draft: true
projectName: "Tops"
---

<!-- Drafted by scripts/draft-hot-releases.mjs from the release calendar's buzz: outlets that announced
each album plus headlines naming the artist. Reorder, cut or swap freely, write the takes, then delete
"draft: true" to publish. Crate notes are hidden comments; they never show on the site. -->

${INTRO}

${blocks.join('\n\n')}

Everything else out in ${monthName.split(' ')[0]} is on the [release calendar](/releases#m-${month}).
`;

if (existsSync(path) && readFileSync(path, 'utf8') === post) {
	console.log(`Hot releases: ${path.replace(ROOT, '')} is up to date.`);
	process.exit(0);
}
writeFileSync(path, post);
console.log(`Hot releases: drafted ${path.replace(ROOT, '')} with ${hot.length} albums: ${hot.map((a) => a.artist).join(', ')}`);
