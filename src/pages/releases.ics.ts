import type { APIRoute } from 'astro';
import { getUpcomingReleases } from '../lib/music';

function escapeIcs(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

function nextDay(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + 1));
	return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

export const GET: APIRoute = () => {
	const releases = getUpcomingReleases().filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate));
	const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Sigil Studios//Release Radar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'X-WR-CALNAME:Sigil Release Radar',
		'X-WR-CALDESC:Upcoming albums tracked by Sigil (sigil.studio/calendar)',
	];

	for (const r of releases) {
		const dtStart = r.releaseDate.replace(/-/g, '');
		const dtEnd = nextDay(r.releaseDate);
		const slug = `${r.artist}-${r.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48);
		const summary = `${r.artist} — ${r.title}${r.type && r.type !== 'LP' ? ` (${r.type})` : ''}`;
		const desc = [
			r.type ? `Format: ${r.type}` : '',
			r.label ? `Label: ${r.label}` : '',
			`Genre: ${r.lane}`,
			'https://sigil.studio/calendar',
		]
			.filter(Boolean)
			.join('\n');

		lines.push(
			'BEGIN:VEVENT',
			`UID:${dtStart}-${slug}@sigil.studio`,
			`DTSTAMP:${stamp}`,
			`DTSTART;VALUE=DATE:${dtStart}`,
			`DTEND;VALUE=DATE:${dtEnd}`,
			`SUMMARY:${escapeIcs(summary)}`,
			`DESCRIPTION:${escapeIcs(desc)}`,
			'URL:https://sigil.studio/calendar',
			'END:VEVENT',
		);
	}

	lines.push('END:VCALENDAR');

	return new Response(lines.join('\r\n') + '\r\n', {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="sigil-releases.ics"',
		},
	});
};
