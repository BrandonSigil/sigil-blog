import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { categoryLabel, getPublishedPosts } from '../lib/music';

export async function GET(context) {
	const posts = await getPublishedPosts();
	return rss({
		title: `${SITE_TITLE} — Music News & Reviews`,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.artist ? `${post.data.artist}: ${post.data.title}` : post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			categories: [categoryLabel(post), ...(post.data.genre ? [post.data.genre] : [])],
			link: `/blog/${post.id}`,
		})),
	});
}
