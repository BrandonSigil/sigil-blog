// The site's sections. Each one collects the posts whose `projectName` frontmatter matches.
// The header nav, section pages and post pages are all driven from this list.
export interface Section {
	slug: string; // URL: /new-music, /reviews, /lists
	label: string; // short name for the nav
	title: string; // page heading
	projectName: string; // the `projectName` value posts in this section use
	blurb: string;
}

export const SECTIONS: Section[] = [
	{
		slug: 'new-music',
		label: 'New Music',
		title: 'New Music Friday',
		projectName: 'New Music Friday',
		blurb: "Our favorite albums from each week's releases, with a playlist to go with them.",
	},
	{
		slug: 'reviews',
		label: 'Reviews',
		title: 'Album Reviews',
		projectName: 'Album Review',
		blurb: 'A longer look at a single record: the sound, the songs, and where it lands for us.',
	},
	{
		slug: 'lists',
		label: 'Lists',
		title: 'Lists',
		projectName: 'Tops',
		blurb: 'The songs and albums that stayed on repeat all year.',
	},
];

export function sectionForProject(projectName?: string): Section | undefined {
	return SECTIONS.find((s) => s.projectName === projectName);
}
