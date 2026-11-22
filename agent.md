# Sigil Blog - Project Notes

## Package Manager
This project uses **Yarn** for dependency management.

```bash
yarn install    # Install dependencies
yarn dev        # Start dev server (localhost:4321)
yarn build      # Build for production
yarn preview    # Preview production build
```

## Design System

### Colors
- **Green (primary)**: `#1a7f4b` - Used for headings, links, accents
- **Green light**: `#2ba366` - Hover states
- **Green dark**: `#145f38` - Active/pressed states
- **White**: `#ffffff` - Background
- **Black**: `#111111` - Body text
- **Gray**: `#666666` - Secondary text, dates
- **Gray light**: `#e5e5e5` - Borders
- **Gray lighter**: `#f5f5f5` - Subtle backgrounds

### Typography
- **Headings**: Space Grotesk (variable font from Fontsource CDN, declared in `global.css`)
- **Body**: Google Sans (Google Fonts stylesheet, linked in `BaseHead.astro`)
- **Style**: Playful but clean geometric sans-serif
- **Headings**: Bold (700), tight letter-spacing (-0.02em), green color
- **Body**: 18px base size, 1.6 line-height

### Design Inspiration
Inspired by [ouchburger.com](https://ouchburger.com) - white background, green accent color, minimal ornamentation, clean grid structure.

## File Structure

```
src/
├── components/
│   ├── BaseHead.astro        # <head> with meta tags, fonts, global styles
│   ├── FeaturedCard.astro    # Post card used in lists (optional "Draft" badge)
│   ├── Footer.astro          # Footer links and copyright
│   ├── FormattedDate.astro   # Date formatting utility
│   ├── Header.astro          # Sticky nav; links come from src/lib/sections.ts
│   ├── HeaderLink.astro      # Nav link with active state styling
│   ├── ReleaseCalendar.astro # "Out this month" and "Anticipated" lists, reads src/data/releases.json
│   └── UpcomingAlbums.astro  # "Upcoming albums" block, reads src/data/upcoming.json
├── content/
│   └── blog/                 # Markdown/MDX blog posts
├── data/
│   ├── releases.json         # Written by scripts/publish-crate.mjs. Do not edit by hand
│   └── upcoming.json         # Written by scripts/publish-crate.mjs. Do not edit by hand
├── layouts/
│   └── BlogPost.astro        # Single post template (prev/next, "More from", review markup)
├── lib/
│   ├── sections.ts           # The site's sections (New Music, Reviews, Lists)
│   ├── posts.ts              # getPosts(): every post the build should show, drafts handled
│   └── albums.ts             # getAlbumPicks(): album picks parsed out of NMF posts
├── pages/
│   ├── index.astro           # Home: hero, upcoming albums, release lists, recent posts, latest playlist
│   ├── [section].astro       # /new-music and /lists
│   ├── reviews.astro         # /reviews, cover grid with scores
│   ├── albums.astro          # /albums, every NMF pick
│   ├── search.astro          # /search
│   ├── about.astro           # About page
│   ├── blog/
│   │   ├── index.astro       # All posts
│   │   └── [...slug].astro   # Dynamic blog post route
│   └── rss.xml.js            # RSS feed generator
├── styles/
│   └── global.css            # CSS variables, typography, utilities
└── consts.ts                 # Site metadata (title, description, author)
scripts/
└── publish-crate.mjs         # Turns a crate export into upcoming.json and releases.json (+ a draft NMF post)
```

## Pages Overview

### Home (`/`)
- Full-height hero with the Sigil logo; on scroll the newest post opens in a desktop-style window
- Upcoming albums (from the crate), "Out this month" and "Anticipated" lists (also from the crate),
  4 recent posts, the latest NMF playlist, About
- Only published posts appear here, even in `yarn dev`

### Sections (`/new-music`, `/reviews`, `/lists`)
- Defined in `src/lib/sections.ts`. A post joins a section through its `projectName`:
  "New Music Friday", "Album Review" or "Tops"
- The header and footer only link to sections that have at least one published post
- To add a section, add it to `SECTIONS`; the nav, section page and post links follow

### Album index (`/albums`) and Search (`/search`)
- Both are built from the posts. Nothing to maintain by hand
- The album index reads every pick out of the New Music Friday posts (format below)

### Album hubs (`/albums/<year>`, `/albums/<year>/<month>`, `/genres`, `/artists`)
- Built from the same picks as the album index, so they grow with every published post
- `/albums/2024` lists that year month by month; `/albums/2024/may` is one month plus its posts
- `/genres/<genre>`: genres are listed in `src/lib/genres.ts`, and each pick's genre lives in
  `src/data/album-genres.json`, keyed by its "Artist - Album" heading. `scripts/publish-crate.mjs`
  adds new picks from their crate lane; existing entries are never overwritten, so fix any by hand.
  A pick missing from the file simply doesn't appear under a genre
- `/artists`: A–Z of everyone picked or reviewed. An artist gets their own page
  (`/artists/<name>`) only once they have two or more picks or reviews, so there are no
  near-empty pages; until then the index links straight to the album in its post
- The "Browse" links (`src/components/HubNav.astro`) sit on the album index and every hub page

### About (`/about`)
- Who is behind the blog and what gets posted here

### Work content (stashed)
The site is music-only. The portfolio page, client-logo marquee and studio About page live in
`stash/work/` (not built or deployed). Do not link to or re-add them unless asked. See
`stash/work/README.md`.

### Blog (`/blog`)
- Every post, newest first

### Blog Post (`/blog/[slug]`)
- Clean reading layout (720px max width)
- Ends with previous / next and "More from <section>", all within the post's own section
- A review with `artist` and `rating` also outputs Review structured data, so search results
  can show the score

## Content

Blog posts live in `src/content/blog/` as Markdown or MDX files. Frontmatter schema:

```yaml
---
title: "Post Title"
description: "Brief description for listings and SEO"
pubDate: 2024-01-15
updatedDate: 2024-01-16  # optional
heroImage: "../../assets/image.jpg"  # optional
draft: true                  # optional, see Drafts
projectName: "Album Review"  # the section: "New Music Friday", "Album Review" or "Tops"
artist: "Geese"              # reviews
genre: "Indie Rock"          # reviews
releaseDate: "Oct. 28, 2025" # reviews
rating: 9                    # reviews, 1 to 10
---
```

Always load posts with `getPosts()` from `src/lib/posts.ts`, not `getCollection('blog')`, so drafts
are handled the same way everywhere.

### Drafts
`draft: true` keeps a post off the built site: no page, not in lists, the feed, search or the
album index. In `yarn dev` drafts show with a "Draft" badge so they can be previewed. Delete the
line to publish. The five placeholder reviews (lorem ipsum) are drafts.

### New Music Friday posts
The first block is the Spotify playlist embed; the homepage picks up the newest one. Each album
pick is a cover image followed directly by a heading, then an optional tasting-notes line:

```markdown
![Artist - Album](../../assets/nmf-2026-11-20/cover.jpg)

## Artist - Album

_Tasting Notes: three or four words_

The write-up.
```

Keep the `Artist - Album` heading format (space, hyphen, space). The album index and search read it.

## Publishing the crate (Upcoming albums, Out this month, Anticipated)

The "Upcoming albums" block shows the albums approved or favorited in the Sigil NMF Crate
(https://claude.ai/artifact/AetYw2LkEDSJysDL2GpiEm) for one release Friday. The site is static, so
the picks are copied into the repo. When asked to "publish the crate":

1. Export two collections from the artifact's database with the `ArtifactData` tool
   (`action: list`, limit 200, each with its own `out_dir` in the scratchpad; every album lands as
   a `.json` file):
   - `weeks/<friday>/albums` (friday as `YYYY-MM-DD`): the week being reviewed
   - `weeks/ahead/albums`: the crate's "Coming up" list, albums announced for later
2. Run `node scripts/publish-crate.mjs <week folder> --ahead <coming-up folder>`. It rewrites
   `src/data/upcoming.json` and `src/assets/upcoming/`, and updates `src/data/releases.json` and
   `src/assets/releases/`. Add `--draft` to also create that Friday's draft post
   (`src/content/blog/nmf-<friday>.md`) with every pick's cover and heading in place; it never
   overwrites an existing post. `--ahead <folder>` on its own updates only the release lists.
3. `yarn build`, then commit and push only when asked.

The block titles itself "Upcoming albums" before the release day and "Out now" from then on, and
hides itself two weeks after release, so a stale week never lingers.

`src/data/releases.json` is a running list, kept between runs: every week's picks, plus every
album starred in "Coming up". `ReleaseCalendar.astro` sorts it by today's date in the browser, so
no rebuild is needed when a date passes:
- "Anticipated": anything not out yet. Un-starring an album in the crate removes it at the next publish.
- "Out this month": anything released earlier in the current calendar month.
- Albums in the current "Upcoming albums" grid stay out of both lists while that grid shows.
- Albums drop out of the file two months after release. Each list hides when it is empty.


## Site Config

Edit `src/consts.ts` to change:
- `SITE_TITLE`: "Sigil"
- `SITE_DESCRIPTION`: the music blog description used for SEO and RSS
- `SITE_AUTHOR`: "Brandon Wirth"

## Image Optimization

**Always use Astro's `<Image>` component** from `astro:assets` instead of plain `<img>` tags for raster images (PNG, JPG, WebP). This automatically:
- Converts images to WebP format
- Resizes and optimizes for the web
- Generates responsive sizes

```astro
---
import { Image } from 'astro:assets';
import myImage from '../assets/image.png';
---
<Image src={myImage} alt="Description" width={800} height={600} />
```

**Exceptions:**
- SVGs can use plain `<img>` tags (they're already optimized vectors)
- External URLs require plain `<img>` tags

When passing images as props, use `ImageMetadata` type:
```typescript
import type { ImageMetadata } from 'astro';
interface Props {
  image?: ImageMetadata;
}
```
