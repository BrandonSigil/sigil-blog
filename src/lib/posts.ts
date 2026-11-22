import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS, type Section } from './sections';

export type Post = CollectionEntry<'blog'>;

// Every post the current build should show, newest first.
// Drafts (`draft: true`) show while writing locally (`yarn dev`) and are left out of the real site.
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function postsInSection(posts: Post[], section: Section): Post[] {
	return posts.filter((p) => p.data.projectName === section.projectName);
}

// Sections that have at least one post to show. The nav only links to these.
export async function getLiveSections(): Promise<Section[]> {
	const posts = await getPosts();
	return SECTIONS.filter((s) => postsInSection(posts, s).length > 0);
}
