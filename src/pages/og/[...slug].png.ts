// Build-time 1200x630 editorial Open Graph share cards generated with Satori + Sharp.
import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import {
	categoryLabel,
	formatShortDate,
	getPublishedPosts,
	inferCategory,
	parseNmfPost,
} from '../../lib/music';

const W = 1200;
const H = 630;
const GREEN = '#3e7d3c';
const GREEN_DARK = '#244a23';
const INK = '#141413';
const MUTED = '#5a5954';
const CREAM = '#f7f6f1';
const LINE = '#dcd9cf';

const fontDir = path.join(process.cwd(), 'node_modules/@fontsource/space-grotesk/files');
const fonts = [
	{
		name: 'Space Grotesk',
		weight: 500 as const,
		style: 'normal' as const,
		data: fs.readFileSync(path.join(fontDir, 'space-grotesk-latin-500-normal.woff')),
	},
	{
		name: 'Space Grotesk',
		weight: 700 as const,
		style: 'normal' as const,
		data: fs.readFileSync(path.join(fontDir, 'space-grotesk-latin-700-normal.woff')),
	},
];

type Node = { type: string; props: Record<string, unknown> };
type Child = Node | string | number | null | undefined | false;

function h(type: string, style: Record<string, unknown>, ...children: Child[]): Node {
	const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
	return { type, props: { style: { display: 'flex', ...style }, children: kids } };
}

function imgNode(src: string, width: number, height: number, radius = 8): Node {
	return {
		type: 'img',
		props: { src, width, height, style: { borderRadius: radius, objectFit: 'cover' } },
	};
}

const imageCache = new Map<string, Promise<string | undefined>>();
function loadDataUri(absPath?: string, size = 360): Promise<string | undefined> {
	if (!absPath) return Promise.resolve(undefined);
	const key = `${absPath}@${size}`;
	if (!imageCache.has(key)) {
		imageCache.set(
			key,
			sharp(absPath)
				.resize(size, size, { fit: 'cover' })
				.jpeg({ quality: 82 })
				.toBuffer()
				.then((buf) => `data:image/jpeg;base64,${buf.toString('base64')}`)
				.catch(() => undefined),
		);
	}
	return imageCache.get(key)!;
}

function truncate(text: string, max: number): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}

async function buildCard(post: CollectionEntry<'blog'>): Promise<Node> {
	const cat = inferCategory(post);
	const label = categoryLabel(post).toUpperCase();
	const dateStr = formatShortDate(post.data.pubDate).toUpperCase();
	const parsed = cat === 'nmf' ? parseNmfPost(post) : null;

	const quote =
		parsed?.albums.find((a) => a.tastingNote)?.tastingNote ??
		post.data.description;

	const mosaicPaths = (parsed?.albums ?? [])
		.map((a) => (a.imagePath ? path.join(process.cwd(), a.imagePath) : undefined))
		.filter((p): p is string => Boolean(p))
		.slice(0, 4);

	let rightPanel: Node;
	if (mosaicPaths.length >= 4) {
		const uris = await Promise.all(mosaicPaths.map((p) => loadDataUri(p, 220)));
		rightPanel = h(
			'div',
			{ width: 432, height: 432, flexWrap: 'wrap', gap: 12 },
			...uris.map((u) =>
				u
					? imgNode(u, 210, 210, 10)
					: h('div', { width: 210, height: 210, borderRadius: 10, background: LINE }),
			),
		);
	} else if (mosaicPaths.length > 0) {
		const uri = await loadDataUri(mosaicPaths[0], 440);
		rightPanel = uri
			? imgNode(uri, 432, 432, 12)
			: h('div', { width: 432, height: 432, borderRadius: 12, background: GREEN_DARK });
	} else {
		rightPanel = h(
			'div',
			{
				width: 432,
				height: 432,
				borderRadius: 12,
				background: GREEN_DARK,
				padding: 36,
				flexDirection: 'column',
				justifyContent: 'space-between',
				color: CREAM,
			},
			h('div', { fontSize: 22, fontWeight: 700, letterSpacing: 3, color: '#a8d8a6' }, label),
			h('div', { fontSize: 44, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }, truncate(post.data.title, 48)),
		);
	}

	return h(
		'div',
		{ width: W, height: H, background: CREAM, fontFamily: 'Space Grotesk', color: INK, flexDirection: 'column' },
		h('div', { width: W, height: 10, background: GREEN }),
		h(
			'div',
			{ flexGrow: 1, padding: '48px 56px 40px', justifyContent: 'space-between', alignItems: 'center', gap: 48 },
			h(
				'div',
				{ flexDirection: 'column', width: 608, height: 486, justifyContent: 'space-between' },
				h(
					'div',
					{ flexDirection: 'column' },
					h(
						'div',
						{ alignItems: 'center', gap: 14, marginBottom: 18 },
						h('div', { fontSize: 18, fontWeight: 700, letterSpacing: 2.5, color: GREEN }, label),
						h('div', { fontSize: 18, color: LINE }, '/'),
						h('div', { fontSize: 18, fontWeight: 500, letterSpacing: 1.5, color: MUTED }, dateStr),
					),
					h(
						'div',
						{ fontSize: 52, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: INK, marginBottom: 22 },
						truncate(post.data.artist ? `${post.data.artist}: ${post.data.title}` : post.data.title, 62),
					),
					h(
						'div',
						{
							borderLeft: `4px solid ${GREEN}`,
							paddingLeft: 18,
							fontSize: 23,
							fontWeight: 500,
							lineHeight: 1.38,
							color: MUTED,
						},
						truncate(quote, 138),
					),
				),
				h(
					'div',
					{
						borderTop: `2px solid ${LINE}`,
						paddingTop: 18,
						justifyContent: 'space-between',
						alignItems: 'center',
					},
					h('div', { fontSize: 24, fontWeight: 700, color: GREEN, letterSpacing: -0.5 }, 'SIGIL'),
					post.data.rating !== undefined
						? h(
								'div',
								{
									background: INK,
									color: CREAM,
									padding: '6px 14px',
									borderRadius: 6,
									fontSize: 22,
									fontWeight: 700,
								},
								`${post.data.rating.toFixed(1)} / 10`,
							)
						: h('div', { fontSize: 20, fontWeight: 500, color: MUTED }, 'sigil.studio'),
				),
			),
			rightPanel,
		),
	);
}

export const getStaticPaths = (async () => {
	const posts = await getPublishedPosts();
	return posts.map((post) => ({
		params: { slug: post.id },
		props: { post },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { post } = props as { post: CollectionEntry<'blog'> };
	const tree = await buildCard(post);
	const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
		width: W,
		height: H,
		fonts,
	});
	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	return new Response(new Uint8Array(png), {
		headers: { 'Content-Type': 'image/png' },
	});
};
