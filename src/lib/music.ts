import path from 'node:path';
import type { ImageMetadata } from 'astro';
import { type CollectionEntry, getCollection } from 'astro:content';
import upcomingRaw from '../data/upcoming-releases.json';

export type PostCategory = 'nmf' | 'review' | 'news' | 'list' | 'essay';

export interface NmfAlbumEntry {
	index: number;
	artist: string;
	album: string;
	headingText: string;
	directUrl?: string;
	image?: ImageMetadata;
	imagePath?: string;
	tastingNote?: string;
	subtitleNote?: string;
	paragraphs: string[];
	spotifyUrl: string;
	youtubeUrl: string;
	bandcampUrl: string;
	appleMusicUrl: string;
}

export interface NmfMoreItem {
	text: string;
	url?: string;
	note?: string;
}

export interface ParsedNmfPost {
	playlistEmbedUrl?: string;
	introParagraphs: string[];
	albums: NmfAlbumEntry[];
	moreHeading?: string;
	moreItems: NmfMoreItem[];
}

export interface CratePick {
	id: string;
	artist: string;
	album: string;
	tastingNote?: string;
	blurbExcerpt: string;
	date: Date;
	year: number;
	postId: string;
	postTitle: string;
	image?: ImageMetadata;
	imagePath?: string;
	spotifyUrl: string;
	bandcampUrl: string;
	directUrl?: string;
}

export interface UpcomingRelease {
	artist: string;
	title: string;
	releaseDate: string;
	type: string;
	label: string;
	lane: string;
	score: number;
	why: string;
	sources?: string[];
	newArtist?: boolean;
}

const assetFiles = import.meta.glob<{ default: ImageMetadata }>(
	'/src/assets/**/*.{jpg,jpeg,png,webp,JPG,PNG}',
	{ eager: true },
);

export const CATEGORY_LABELS: Record<PostCategory, string> = {
	nmf: 'New Music Friday',
	review: 'Album Review',
	list: 'Best Of',
	news: 'The Wire',
	essay: 'Feature',
};

export function inferCategory(post: CollectionEntry<'blog'>): PostCategory {
	if (post.data.category) return post.data.category;
	const project = (post.data.projectName ?? '').toLowerCase();
	if (project.includes('new music friday')) return 'nmf';
	if (project.includes('review') || post.data.rating !== undefined) return 'review';
	if (project.includes('top') || project.includes('list') || post.data.title.toLowerCase().startsWith('top ')) {
		return 'list';
	}
	if (project.includes('news') || project.includes('wire') || project.includes('digest')) return 'news';
	return 'essay';
}

export function categoryLabel(post: CollectionEntry<'blog'>): string {
	return CATEGORY_LABELS[inferCategory(post)];
}

export function estimateReadTime(body?: string): number {
	if (!body) return 1;
	const clean = body
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[#_*`>-]/g, ' ');
	const words = clean.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 220));
}

export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
	const posts = await getCollection('blog', ({ data }) => !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function buildSearchLinks(artist: string, album: string, directUrl?: string) {
	const query = encodeURIComponent(`${artist} ${album}`.trim());
	const spotifySearch = `https://open.spotify.com/search/${query}`;
	const youtubeSearch = `https://www.youtube.com/results?search_query=${query}`;
	const bandcampSearch = `https://bandcamp.com/search?q=${query}`;
	const appleSearch = `https://music.apple.com/us/search?term=${query}`;

	const spotifyUrl = directUrl && directUrl.includes('spotify.com') ? directUrl : spotifySearch;
	const youtubeUrl = directUrl && directUrl.includes('youtube.com') ? directUrl : youtubeSearch;
	const bandcampUrl = directUrl && directUrl.includes('bandcamp.com') ? directUrl : bandcampSearch;
	const appleMusicUrl = directUrl && directUrl.includes('apple.com') ? directUrl : appleSearch;

	return { spotifyUrl, youtubeUrl, bandcampUrl, appleMusicUrl };
}

function resolveAsset(relPath?: string): { image?: ImageMetadata; imagePath?: string } {
	if (!relPath) return {};
	const assetKey = path.posix.join('/src/content/blog', relPath);
	const found = assetFiles[assetKey]?.default;
	return {
		image: found,
		imagePath: found ? assetKey.slice(1) : undefined,
	};
}

function stripMarkdownLink(raw: string): { text: string; url?: string } {
	const match = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/);
	if (match) {
		return {
			text: `${match[1]}${match[3] ?? ''}`.trim(),
			url: match[2],
		};
	}
	return { text: raw.trim() };
}

function splitArtistAlbum(text: string): { artist: string; album: string } {
	// Support " - " or " — " or " – "
	const sepMatch = text.match(/^(.+?)\s+[-–—]\s+(.+)$/);
	if (sepMatch) {
		return { artist: sepMatch[1].trim(), album: sepMatch[2].trim() };
	}
	return { artist: text.trim(), album: '' };
}

function cleanExcerpt(text: string, maxLen = 155): string {
	const plain = text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\\([&!*_])/g, '$1')
		.replace(/[_*`]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (plain.length <= maxLen) return plain;
	return plain.slice(0, maxLen - 1).trimEnd() + '…';
}

export function renderInlineMarkdown(input: string): string {
	const escaped = input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\\([&!*_[\]])/g, '$1');

	return escaped
		.replace(
			/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
		)
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[\s(])_([^_]+)_(?=[\s.,!?;:)\]]|$)/g, '$1<em>$2</em>')
		.replace(/(^|[\s(])\*([^*]+)\*(?=[\s.,!?;:)\]]|$)/g, '$1<em>$2</em>');
}

export function parseNmfPost(post: CollectionEntry<'blog'>): ParsedNmfPost {
	const body = post.body ?? '';
	const lines = body.split('\n');

	let playlistEmbedUrl: string | undefined;
	const introParagraphs: string[] = [];
	const albums: NmfAlbumEntry[] = [];
	let moreHeading: string | undefined;
	const moreItems: NmfMoreItem[] = [];

	let pendingImage: string | undefined;
	let currentAlbum: NmfAlbumEntry | null = null;
	let inMoreSection = false;

	const isMoreTitle = (t: string) =>
		/^(and more|hot leads|honorable mentions|also out|bonus|quick hits)/i.test(t.trim());

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		// Horizontal rule resets image attachment if needed
		if (/^---+$/.test(line)) {
			continue;
		}

		// Spotify / audio iframe (sometimes accidentally prefixed with ## )
		if (line.includes('<iframe')) {
			const srcMatch = line.match(/src=["']([^"']+)["']/);
			if (srcMatch && !playlistEmbedUrl) {
				playlistEmbedUrl = srcMatch[1];
			}
			continue;
		}

		// Markdown image line
		const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
		if (imgMatch) {
			pendingImage = imgMatch[2];
			continue;
		}

		// H2 section header
		const h2Match = line.match(/^##\s+(.+)$/);
		if (h2Match) {
			const rawHeading = h2Match[1].trim();
			const { text: headingText, url: directUrl } = stripMarkdownLink(rawHeading);

			if (isMoreTitle(headingText)) {
				inMoreSection = true;
				currentAlbum = null;
				moreHeading = headingText;
				pendingImage = undefined;
				continue;
			}

			// Check if this looks like an album entry (either has an image above it or has "Artist - Album" separator)
			const { artist, album } = splitArtistAlbum(headingText);
			if (pendingImage || album) {
				inMoreSection = false;
				const { image, imagePath } = resolveAsset(pendingImage);
				const links = buildSearchLinks(artist, album || headingText, directUrl);
				currentAlbum = {
					index: albums.length + 1,
					artist,
					album: album || headingText,
					headingText,
					directUrl,
					image,
					imagePath,
					paragraphs: [],
					...links,
				};
				albums.push(currentAlbum);
				pendingImage = undefined;
				continue;
			}

			// Non-album subheading (e.g. "## June 21st") — treat as intro/prose
			currentAlbum = null;
			pendingImage = undefined;
			continue;
		}

		// Bullet items under "And More!" / "Hot Leads!"
		if (inMoreSection && /^[-*]\s+/.test(line)) {
			const itemBody = line.replace(/^[-*]\s+/, '').trim();
			const linkMatch = itemBody.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(?::\s*(.+))?$/);
			if (linkMatch) {
				moreItems.push({
					text: linkMatch[1].trim(),
					url: linkMatch[2],
					note: linkMatch[3]?.trim(),
				});
			} else {
				const colonIdx = itemBody.indexOf(': ');
				if (colonIdx !== -1) {
					moreItems.push({
						text: itemBody.slice(0, colonIdx).trim(),
						note: itemBody.slice(colonIdx + 2).trim(),
					});
				} else {
					moreItems.push({ text: itemBody });
				}
			}
			continue;
		}

		// Content inside an album block
		if (currentAlbum) {
			const tastingMatch = line.match(/^[_*]Tasting Notes:\s*(.+?)[_*]$/i);
			if (tastingMatch) {
				currentAlbum.tastingNote = tastingMatch[1].trim();
				continue;
			}
			// Short italicized subtitle line like "_Alex Wirth Edition ❤️_"
			const subMatch = line.match(/^[_*]([^_*]{3,80})[_*]$/);
			if (subMatch && currentAlbum.paragraphs.length === 0 && !currentAlbum.subtitleNote) {
				currentAlbum.subtitleNote = subMatch[1].trim();
				continue;
			}
			currentAlbum.paragraphs.push(line);
			continue;
		}

		// Intro paragraph before albums
		if (!inMoreSection) {
			introParagraphs.push(line);
		}
	}

	return {
		playlistEmbedUrl,
		introParagraphs,
		albums,
		moreHeading,
		moreItems,
	};
}

export async function getAllCratePicks(): Promise<CratePick[]> {
	const posts = await getPublishedPosts();
	const nmfPosts = posts.filter((p) => inferCategory(p) === 'nmf');
	const picks: CratePick[] = [];

	for (const post of nmfPosts) {
		const parsed = parseNmfPost(post);
		for (const album of parsed.albums) {
			if (!album.image && !album.album) continue;
			picks.push({
				id: `${post.id}-${album.index}`,
				artist: album.artist,
				album: album.album,
				tastingNote: album.tastingNote ?? album.subtitleNote,
				blurbExcerpt: cleanExcerpt(album.paragraphs[0] ?? post.data.description, 140),
				date: post.data.pubDate,
				year: post.data.pubDate.getFullYear(),
				postId: post.id,
				postTitle: post.data.title,
				image: album.image,
				imagePath: album.imagePath,
				spotifyUrl: album.spotifyUrl,
				bandcampUrl: album.bandcampUrl,
				directUrl: album.directUrl,
			});
		}
	}
	return picks;
}

export function getUpcomingReleases(): UpcomingRelease[] {
	const items = (upcomingRaw as UpcomingRelease[]).slice();
	return items.sort((a, b) => {
		const dateCmp = a.releaseDate.localeCompare(b.releaseDate);
		if (dateCmp !== 0) return dateCmp;
		return b.score - a.score;
	});
}

export function groupUpcomingByDate(releases: UpcomingRelease[]) {
	const map = new Map<string, UpcomingRelease[]>();
	for (const r of releases) {
		const key = r.releaseDate;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(r);
	}
	return [...map.entries()].map(([date, items]) => ({
		date,
		formattedDate: formatReleaseDate(date),
		abbrevDate: formatAbbrevDate(date),
		items: items.sort((a, b) => b.score - a.score),
	}));
}

const ABBREV_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

export function formatAbbrevDate(iso: string): string {
	const parts = iso.split('-').map(Number);
	if (parts.length === 3) {
		const month = ABBREV_MONTHS[parts[1] - 1] ?? '';
		return `${month} ${parts[2]}`;
	}
	if (parts.length === 2) {
		return ABBREV_MONTHS[parts[1] - 1] ?? iso;
	}
	return iso;
}

export function formatReleaseDate(iso: string): string {
	const parts = iso.split('-').map(Number);
	if (parts.length === 3) {
		const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
		return d.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
	if (parts.length === 2) {
		const d = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
		return d.toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}
	return iso;
}

export function formatShortDate(date: Date): string {
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

export function getPostCoverMosaic(post: CollectionEntry<'blog'>): ImageMetadata[] {
	if (inferCategory(post) !== 'nmf') return [];
	const parsed = parseNmfPost(post);
	return parsed.albums
		.map((a) => a.image)
		.filter((img): img is ImageMetadata => Boolean(img))
		.slice(0, 4);
}

/** Pick a punchy spotlight cover for live NMF posters (no baked-in text JPG needed). */
export function getSpotlightCover(post: CollectionEntry<'blog'>): ImageMetadata | undefined {
	if (inferCategory(post) !== 'nmf') return post.data.heroImage;
	const covers = getPostCoverMosaic(post);
	if (covers.length === 0) return undefined;
	// For May 8th, highlight Basement's iconic thermal cat artwork (index 1)
	if (post.id === 'nmf-may-8' && covers[1]) return covers[1];
	return covers[0];
}
