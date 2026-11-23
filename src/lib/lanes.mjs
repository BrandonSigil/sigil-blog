// The Sigil NMF Crate's lanes, shared by the album hubs (genres.ts), the release calendar
// (calendar-core.mjs) and the Node scripts. Plain JS so the scripts can import it too.
// The names match the crate's badges (the LANES map in nmf/review.html), so a pick's lane can be
// copied straight into src/data/album-genres.json.

/** Every lane the hubs and calendar know, in display order. Reissues & archives is a crate lane
 * but not a genre, so it is left out. */
export const LANES = [
	{ name: 'Indie & folk', slug: 'indie-folk' },
	{ name: 'Indie pop', slug: 'indie-pop' },
	{ name: 'Rock', slug: 'rock' },
	{ name: 'Pop', slug: 'pop' },
	{ name: 'Soul & funk', slug: 'soul-funk' },
	{ name: 'R&B & neo-soul', slug: 'rnb-neo-soul' },
	{ name: 'Hip-hop', slug: 'hip-hop' },
	{ name: 'Electronic & dance', slug: 'electronic-dance' },
	{ name: 'Jazz', slug: 'jazz' },
	{ name: 'Ambient & classical', slug: 'ambient-classical' },
	{ name: 'Country & roots', slug: 'country-roots' },
	{ name: 'Worship', slug: 'worship' },
];

export const REISSUES = 'Reissues & archives';

/** Words in a genre string (Wikipedia's, or a crate note) that point at a lane. First match wins,
 * so the narrow lanes come before the broad ones (neo-soul before soul, indie pop before indie). */
export const GENRE_WORDS = [
	['Worship', /gospel|worship|\bccm\b|christian|praise/i],
	['Hip-hop', /hip[- ]?hop|\brap\b|trap|drill|grime/i],
	['R&B & neo-soul', /r&b|rnb|rhythm and blues|neo[- ]soul|alt[- ]r&b/i],
	['Soul & funk', /soul|funk|motown/i],
	['Jazz', /jazz|bebop|big band/i],
	['Ambient & classical', /ambient|classical|new age|instrumental|score|soundtrack|drone|modern composition|neo[- ]classical|orchestral/i],
	['Electronic & dance', /electronic|house|techno|\bedm\b|\bdance\b(?!-pop)|idm|drum and bass|dubstep|trance|electronica/i],
	['Country & roots', /country|americana|bluegrass|roots|western/i],
	['Indie pop', /indie[- ]pop|dream pop|bedroom pop|jangle pop|chamber pop|twee/i],
	['Indie & folk', /indie|folk|singer-songwriter|lo-fi|chamber/i],
	['Rock', /metal|rock|punk|hardcore|grunge|\bemo\b|shoegaze|noise|core\b/i],
	['Pop', /pop/i],
];

/** Old lane names and the lanes they split into. Data written before the 2026-11-23 split still
 * uses them; each resolves to the first new lane its hint text points at, else the first listed. */
const OLD_LANES = {
	'Jazz & ambient': ['Jazz', 'Ambient & classical', 'Electronic & dance'],
	Electronic: ['Electronic & dance'],
};

/**
 * A lane name as it is now. Current names pass through; old names ("Jazz & ambient",
 * "Electronic") become the new lane that `hint` (a genre string or crate note) points at.
 * @param {string | null | undefined} lane
 * @param {string} [hint]
 * @returns {string | null}
 */
export function currentLane(lane, hint = '') {
	if (!lane) return null;
	const split = OLD_LANES[lane];
	if (!split) return lane;
	for (const [name, re] of GENRE_WORDS) if (split.includes(name) && re.test(hint)) return name;
	return split[0];
}
