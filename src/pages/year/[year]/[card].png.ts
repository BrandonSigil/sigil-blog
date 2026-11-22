// Share cards for Year in Sigil: one 1080x1350 PNG per section, rendered at build time
// with Satori (layout to SVG) and sharp (SVG to PNG). Nothing runs at request time.
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import sharp from 'sharp';
import {
	CARDS,
	type CardName,
	type Pick,
	albumList,
	allYears,
	picksFor,
	songList,
	stats,
	yearData,
} from '../../../lib/year-in-sigil';

const W = 1080;
const H = 1350;
const GREEN = '#3e7d3c';
const INK = '#111111';
const GRAY = '#666666';
const CREAM = '#f7f6f1';
const LINE = '#dcdad2';

const fontDir = path.join(process.cwd(), 'node_modules/@fontsource/space-grotesk/files');
const fonts = [
	{ name: 'Space Grotesk', weight: 500 as const, style: 'normal' as const, data: fs.readFileSync(path.join(fontDir, 'space-grotesk-latin-500-normal.woff')) },
	{ name: 'Space Grotesk', weight: 700 as const, style: 'normal' as const, data: fs.readFileSync(path.join(fontDir, 'space-grotesk-latin-700-normal.woff')) },
];

type Node = { type: string; props: Record<string, unknown> };
type Child = Node | string | number | null | undefined | false;

function h(type: string, style: Record<string, unknown>, ...children: Child[]): Node {
	const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
	return { type, props: { style: { display: 'flex', ...style }, children: kids } };
}

function img(src: string, size: number, radius = 6): Node {
	return { type: 'img', props: { src, width: size, height: size, style: { borderRadius: radius, objectFit: 'cover' } } };
}

const coverCache = new Map<string, Promise<string | undefined>>();
function cover(p?: Pick): Promise<string | undefined> {
	if (!p?.coverPath) return Promise.resolve(undefined);
	if (!coverCache.has(p.coverPath)) {
		coverCache.set(
			p.coverPath,
			sharp(path.join(process.cwd(), p.coverPath))
				.resize(320, 320, { fit: 'cover' })
				.jpeg({ quality: 82 })
				.toBuffer()
				.then((b) => `data:image/jpeg;base64,${b.toString('base64')}`)
				.catch(() => undefined),
		);
	}
	return coverCache.get(p.coverPath)!;
}

function chunk<T>(items: T[], n: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += Math.max(1, n)) out.push(items.slice(i, i + Math.max(1, n)));
	return out;
}

function blank(size: number): Node {
	return h('div', { width: size, height: size, borderRadius: 6, background: LINE });
}

function frame(year: number, title: string, draft: boolean, body: Node): Node {
	// Padding sits on an inner box: on the root it would be added outside the 1080px width.
	return h('div', { width: W, height: H, background: CREAM }, h(
		'div',
		{ flexGrow: 1, flexDirection: 'column', padding: 80, fontFamily: 'Space Grotesk', color: INK },
		h(
			'div',
			{ justifyContent: 'space-between', alignItems: 'flex-start' },
			h(
				'div',
				{ flexDirection: 'column' },
				h('div', { fontSize: 28, fontWeight: 700, letterSpacing: 4, color: GREEN }, 'YEAR IN SIGIL'),
				h('div', { fontSize: 120, fontWeight: 700, letterSpacing: -5, lineHeight: 1, color: GREEN, marginTop: 8 }, String(year)),
			),
			draft ? h('div', { fontSize: 24, fontWeight: 700, color: GRAY, border: `3px solid ${GRAY}`, borderRadius: 8, padding: '6px 14px' }, 'DRAFT') : null,
		),
		h('div', { fontSize: 52, fontWeight: 700, letterSpacing: -1.5, marginTop: 24, marginBottom: 32 }, title),
		h('div', { flexGrow: 1, flexDirection: 'column', overflow: 'hidden' }, body),
		h(
			'div',
			{ justifyContent: 'space-between', borderTop: `3px solid ${INK}`, paddingTop: 24, fontSize: 28, fontWeight: 500 },
			h('div', {}, 'Sigil'),
			h('div', { color: GRAY }, `sigil.studio/year/${year}`),
		),
	));
}

async function build(card: CardName, year: number): Promise<Node> {
	const data = yearData(year)!;
	const picks = await picksFor(data);
	const s = stats(picks);

	if (card === 'summary') {
		const covers = await Promise.all(picks.slice(0, 15).map(cover));
		const size = 168;
		return frame(
			year,
			'The year in picks',
			data.draft,
			h(
				'div',
				{ flexDirection: 'column' },
				h(
					'div',
					{ gap: 64, marginBottom: 48 },
					...[
						[s.picks, 'albums picked'],
						[s.fridays, 'Fridays'],
						[s.lanes.length, 'lanes'],
					].map(([n, label]) =>
						h('div', { flexDirection: 'column' },
							h('div', { fontSize: 104, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }, String(n)),
							h('div', { fontSize: 30, fontWeight: 500, color: GRAY, marginTop: 8 }, String(label)),
						),
					),
				),
				h('div', { flexWrap: 'wrap', gap: 16 }, ...covers.map((c) => (c ? img(c, size) : blank(size)))),
			),
		);
	}

	if (card === 'months') {
		// Shrink covers so all twelve months still fit; a busy month wraps onto a second line.
		const size = Math.min(120, Math.floor(780 / Math.max(1, s.byMonth.length)) - 14);
		const rows = await Promise.all(
			s.byMonth.map(async (m) => ({ name: m.name, covers: await Promise.all(m.picks.map(cover)) })),
		);
		return frame(
			year,
			'Month by month',
			data.draft,
			h(
				'div',
				{ flexDirection: 'column', gap: 14 },
				...rows.map((r) =>
					h('div', { alignItems: 'flex-start', gap: 24 },
						h('div', { width: 220, fontSize: Math.min(40, size * 0.45), fontWeight: 700, color: GREEN }, r.name),
						h('div', { flexDirection: 'column', gap: 12 },
							...chunk(r.covers, Math.floor(688 / (size + 12))).map((line) =>
								h('div', { gap: 12 }, ...line.map((c) => (c ? img(c, size) : blank(size)))),
							),
						),
					),
				),
			),
		);
	}

	if (card === 'lanes') {
		const max = Math.max(1, ...s.lanes.map((l) => l.count));
		// Tighter rows when there are many lanes, so the list never runs into the footer.
		const tight = s.lanes.length > 6;
		const text = tight ? 30 : 38;
		const bar = tight ? 18 : 26;
		return frame(
			year,
			'Where the picks landed',
			data.draft,
			h(
				'div',
				{ flexDirection: 'column', gap: tight ? 16 : 30 },
				...s.lanes.map((l) =>
					h('div', { flexDirection: 'column', gap: tight ? 6 : 10 },
						h('div', { justifyContent: 'space-between', fontSize: text, fontWeight: 700 },
							h('div', {}, l.name),
							h('div', { color: GRAY }, String(l.count)),
						),
						h('div', { width: 920, height: bar, background: LINE, borderRadius: bar / 2 },
							h('div', { width: Math.round((920 * l.count) / max), height: bar, background: GREEN, borderRadius: bar / 2 }),
						),
					),
				),
			),
		);
	}

	if (card === 'albums') {
		const list = albumList(data, picks);
		const items = list.items.slice(0, 10);
		const covers = await Promise.all(items.map((a) => cover(a.pick)));
		const size = 62;
		return frame(
			year,
			list.ranked ? 'Top 10 albums' : 'Album candidates',
			data.draft,
			h(
				'div',
				{ flexDirection: 'column', gap: 10 },
				...items.map((a, i) =>
					h('div', { alignItems: 'center', gap: 22 },
						h('div', { width: 64, fontSize: 40, fontWeight: 700, color: GREEN }, list.ranked ? String(i + 1) : '·'),
						covers[i] ? img(covers[i]!, size, 4) : blank(size),
						h('div', { flexDirection: 'column' },
							h('div', { fontSize: 30, fontWeight: 700, lineHeight: 1.1 }, a.album),
							h('div', { fontSize: 22, fontWeight: 500, color: GRAY }, a.artist),
						),
					),
				),
			),
		);
	}

	const songs = songList(data);
	return frame(
		year,
		songs.ranked ? 'Top 10 songs' : 'Song candidates',
		data.draft,
		h(
			'div',
			{ flexDirection: 'column', gap: 18 },
			...songs.items.slice(0, 10).map((song, i) =>
				h('div', { alignItems: 'baseline', gap: 22, borderBottom: `2px solid ${LINE}`, paddingBottom: 14 },
					h('div', { width: 64, fontSize: 40, fontWeight: 700, color: GREEN }, songs.ranked ? String(i + 1) : '·'),
					h('div', { fontSize: 36, fontWeight: 700 }, song.title),
					h('div', { fontSize: 26, fontWeight: 500, color: GRAY }, song.artist),
				),
			),
		),
	);
}

export const getStaticPaths = (() =>
	allYears().flatMap((d) => CARDS.map((card) => ({ params: { year: String(d.year), card } })))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
	const year = Number(params.year);
	const card = params.card as CardName;
	const svg = await satori((await build(card, year)) as unknown as Parameters<typeof satori>[0], {
		width: W,
		height: H,
		fonts,
	});
	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
