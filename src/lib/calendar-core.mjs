// The release calendar's logic, shared by the site (src/lib/calendar.ts) and the monthly
// "hot releases" draft (scripts/draft-hot-releases.mjs). Plain JS so Node can run it directly.
//
// Inputs, all plain data:
//   wiki    src/data/calendar-wiki.json albums (Wikipedia: date, artist, album, genre, label, outlets)
//   crate   src/data/crate-scores.json albums (the crate: fit score, lane, sources, reissue)
//   press   src/data/calendar-press.json stories (headlines naming calendar artists)
//   history { artists: names picked or reviewed on Sigil, picks: "Artist - Album" keys picked,
//             laneCounts: { lane: number of Sigil picks in it } }
//
// Each album gets:
//   score   the crate's fit score when the crate has the album; otherwise an estimate from how
//           often Sigil picks that genre, whether Sigil has covered the artist, and whether
//           indie-minded outlets announced it ("estimated: true")
//   buzz    how widely it is covered: outlets cited on Wikipedia + outlets that put it in the
//           crate + twice the headlines naming the artist around its release

export const LANES = ['Indie & folk', 'Rock', 'Soul & funk', 'Hip-hop', 'Jazz & ambient', 'Electronic', 'Pop', 'Country & roots'];

const GENRE_WORDS = [
	['Hip-hop', /hip[- ]?hop|\brap\b|trap|drill|grime/i],
	['Soul & funk', /r&b|rhythm and blues|soul|funk|gospel/i],
	['Jazz & ambient', /jazz|ambient|classical|new age|instrumental|score/i],
	['Electronic', /electronic|house|techno|\bedm\b|dance|idm|drum and bass|dubstep|trance/i],
	['Country & roots', /country|americana|bluegrass|roots|western/i],
	['Indie & folk', /indie|folk|singer-songwriter|dream pop|lo-fi|chamber/i],
	['Rock', /metal|rock|punk|hardcore|grunge|\bemo\b|shoegaze|noise|core\b/i],
	['Pop', /pop/i],
];

// Outlets that mostly cover one kind of music, as a genre hint when Wikipedia has no genre.
const OUTLET_LANES = [
	['Rock', /blabbermouth|lambgoat|kerrang|metal|revolver|loudwire|louder|decibel|classic rock|distorted sound|ghost cult|brave words|theprp|new noise|punknews|dead press/i],
	['Hip-hop', /hotnewhiphop|\bxxl\b|the source|complex|hiphopdx|allhiphop|rap radar|okayplayer|hip ?hop/i],
	['Country & roots', /country|americana|whiskey riff|holler|bluegrass|cmt\b|no depression/i],
	['Electronic', /mixmag|resident advisor|dj mag|dancing astronaut|edm|magnetic mag|xlr8r|attack mag/i],
	['Jazz & ambient', /jazz|downbeat|jazzwise|a closer listen/i],
	['Soul & funk', /soultracks|rated r&b|rap-up/i],
];
const INDIE_OUTLETS = /pitchfork|stereogum|brooklyn ?vegan|line of best fit|under the radar|paste|\bdork\b|\bdiy\b|clash|gorilla vs|exclaim|bandcamp|npr|the fader|consequence|indie is not a genre|no ripcord|uproxx|the quietus|beats per minute|aquarium drunkard|post-trash/i;

/** Loose matching key: case, accents, punctuation and "the" don't matter. */
export function looseKey(artist, title) {
	const norm = (s) =>
		s
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/&/g, 'and')
			.replace(/^the\s+/, '')
			.replace(/[^a-z0-9]+/g, '');
	return `${norm(artist)}|${norm(title)}`;
}

const splitArtists = (artist) => artist.split(/\s+(?:&|and|x|with|feat\.?)\s+|,\s*/i).map((n) => n.trim()).filter(Boolean);

function laneFromWiki(a) {
	if (a.genre) for (const [lane, re] of GENRE_WORDS) if (re.test(a.genre)) return lane;
	for (const [lane, re] of OUTLET_LANES) if (a.outlets?.some((o) => re.test(o))) return lane;
	return null;
}

// Archival, live and anniversary records: in the calendar, but never on the hot list and ranked
// below new albums in "Out this month".
const ARCHIVAL = /anniversary|deluxe|remaster|expanded|reissue|\bdemos?\b|demoed|\bsessions?\b|\blive (?:at|from|in|on)\b|\(live\)|\blive album\b|[-–] live\b|first studio recording|revealed|years \d{4}|\b(19|20)\d\d\s*[–-]\s*(19|20)\d\d\b/i;
// Not outlets: the crate lists these as where it found an album.
const NOT_OUTLETS = /^(wikipedia|musicbrainz)$/i;
const cleanOutlets = (list) => list.filter((o) => o && !NOT_OUTLETS.test(o) && !/\d{4}/.test(o) && !/^\d/.test(o));

const day = (date) => (date.length === 10 ? date : null);
const dayMs = 86400000;

export function buildCalendar({ wiki = [], crate = [], press = {}, history }) {
	const sigilArtists = new Set(history.artists.map((n) => n.toLowerCase()));
	const pickKeys = new Set(history.picks.map((k) => k.toLowerCase().replace(/\s+/g, ' ').trim()));
	const pickLoose = new Set(history.picks.map((k) => {
		const i = k.indexOf(' - ');
		return i > -1 ? looseKey(k.slice(0, i), k.slice(i + 3)) : k;
	}));
	const maxLane = Math.max(1, ...Object.values(history.laneCounts));

	// Merge: Wikipedia rows first, then the crate fills in or adds.
	const byKey = new Map();
	for (const w of wiki) {
		byKey.set(looseKey(w.artist, w.title), {
			artist: w.artist,
			title: w.title,
			releaseDate: w.releaseDate,
			label: w.label || null,
			genre: w.genre || null,
			lane: laneFromWiki(w),
			type: null,
			reissue: false,
			outlets: cleanOutlets(w.outlets ?? []),
			crateScore: null,
			why: '',
			sources: ['wikipedia'],
		});
	}
	for (const c of crate) {
		const k = looseKey(c.artist, c.title);
		const old = byKey.get(k);
		const merged = old ?? {
			artist: c.artist,
			title: c.title,
			releaseDate: c.releaseDate,
			label: null,
			genre: null,
			lane: null,
			outlets: [],
			sources: [],
		};
		// The crate knows the exact Friday; Wikipedia sometimes only the month.
		if (!day(merged.releaseDate) && day(c.releaseDate)) merged.releaseDate = c.releaseDate;
		if (c.lane && c.lane !== 'Reissues & archives') merged.lane = c.lane;
		merged.type = c.type ?? merged.type ?? null;
		merged.reissue = !!c.reissue || c.lane === 'Reissues & archives';
		merged.crateScore = c.score;
		merged.why = c.why ?? '';
		merged.decision = c.decision ?? null;
		const seen = new Set(merged.outlets.map((o) => o.toLowerCase()));
		for (const s of cleanOutlets(c.sources ?? [])) if (!seen.has(s.toLowerCase())) merged.outlets.push(s);
		merged.sources = [...new Set([...merged.sources, 'crate'])];
		byKey.set(k, merged);
	}

	// Headlines per artist name, with dates, for buzz around each release.
	const headlines = new Map();
	for (const s of Object.values(press)) {
		for (const n of s.artists) {
			const key = n.toLowerCase();
			if (!headlines.has(key)) headlines.set(key, []);
			headlines.get(key).push(new Date(s.date).valueOf());
		}
	}

	return [...byKey.values()]
		.map((a) => {
			const names = splitArtists(a.artist).map((n) => n.toLowerCase());
			const onSigil = names.some((n) => sigilArtists.has(n)) || sigilArtists.has(a.artist.toLowerCase());
			const key = `${a.artist} - ${a.title}`.toLowerCase().replace(/\s+/g, ' ').trim();
			const picked = pickKeys.has(key) || pickLoose.has(looseKey(a.artist, a.title));

			const release = new Date(`${day(a.releaseDate) ?? `${a.releaseDate}-15`}T12:00:00Z`).valueOf();
			const pressCount = names.reduce(
				(n, name) => n + (headlines.get(name) ?? []).filter((t) => t >= release - 45 * dayMs && t <= release + 21 * dayMs).length,
				0,
			);
			const buzz = a.outlets.length + 2 * pressCount;

			const archival = !!a.reissue || ARCHIVAL.test(a.title) || /live|compilation/i.test(a.type ?? '');
			let score = a.crateScore;
			let estimated = false;
			if (typeof score !== 'number') {
				estimated = true;
				// Estimates stay below the crate's strong scores: the crate actually looked at the record.
				const laneShare = a.lane ? (history.laneCounts[a.lane] ?? 0) / maxLane : 0.15;
				score = 40 + Math.round(25 * laneShare);
				if (onSigil) score += 12;
				if (a.outlets.some((o) => INDIE_OUTLETS.test(o))) score += 5;
				score = Math.max(30, Math.min(79, score));
			}

			return {
				id: looseKey(a.artist, a.title).replace('|', '-').slice(0, 120), // also the cover's file name
				artist: a.artist,
				title: a.title,
				releaseDate: a.releaseDate,
				month: a.releaseDate.slice(0, 7),
				hasDay: !!day(a.releaseDate),
				label: a.label,
				lane: a.lane,
				type: a.type ?? null,
				reissue: archival,
				score,
				/** For ordering only: archival records sit 15 points lower. */
				rank: score - (archival ? 15 : 0),
				estimated,
				buzz,
				pressCount,
				outlets: a.outlets,
				why: a.why ?? '',
				onSigil,
				picked,
				inCrate: a.sources.includes('crate'),
			};
		})
		.sort((x, y) => x.releaseDate.localeCompare(y.releaseDate) || y.score - x.score || x.artist.localeCompare(y.artist));
}

/** One month, best fit first (the homepage's "Out this month"). */
export function byTaste(albums, month) {
	return albums
		.filter((a) => a.month === month)
		.sort((x, y) => y.rank - x.rank || Number(x.estimated) - Number(y.estimated) || y.buzz - x.buzz || x.artist.localeCompare(y.artist));
}

/** The month's most talked-about new albums: no reissues, live albums or soundtracks. */
export function hotList(albums, month, count = 10) {
	return albums
		.filter((a) => a.month === month && !a.reissue && !/soundtrack/i.test(a.type ?? '') && !/soundtrack|original score/i.test(a.title))
		.sort((x, y) => y.buzz - x.buzz || y.score - x.score || x.artist.localeCompare(y.artist))
		.slice(0, count);
}

export const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
