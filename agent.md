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
- **Font**: Space Grotesk (variable font from Fontsource CDN)
- **Style**: Playful but clean geometric sans-serif
- **Headings**: Bold (700), tight letter-spacing (-0.02em), green color
- **Body**: 18px base size, 1.6 line-height

### Design Inspiration
Inspired by [ouchburger.com](https://ouchburger.com) - white background, green accent color, minimal ornamentation, clean grid structure.

## File Structure

```
src/
├── components/
│   ├── BaseHead.astro        # <head> with meta tags, global styles
│   ├── Footer.astro          # Simple copyright footer
│   ├── FormattedDate.astro   # Date formatting utility
│   ├── Header.astro          # Sticky navigation header
│   └── HeaderLink.astro      # Nav link with active state styling
├── content/
│   └── blog/                 # Markdown/MDX blog posts
├── layouts/
│   └── BlogPost.astro        # Single blog post template
├── pages/
│   ├── index.astro           # Home/landing page
│   ├── portfolio.astro       # Portfolio with project cards
│   ├── blog/
│   │   ├── index.astro       # Blog listing
│   │   └── [...slug].astro   # Dynamic blog post route
│   └── rss.xml.js            # RSS feed generator
├── styles/
│   └── global.css            # CSS variables, typography, utilities
└── consts.ts                 # Site metadata (title, description, author)
```

## Pages Overview

### Home (`/`)
- Hero section with large title and tagline
- Two CTAs: "Read the Blog" and "View Portfolio"
- Recent posts preview (3 most recent)
- About section with author info

### Portfolio (`/portfolio`)
- Grid of project cards
- Each card has: title, description, tech tags, link
- Hover effect: green border, slight lift

### Blog (`/blog`)
- List of all posts, sorted newest first
- Cards show title, description, and date
- Hover effect: green border, slide right

### Blog Post (`/blog/[slug]`)
- Clean reading layout (720px max width)
- Post meta: date, updated date
- Back to blog link at bottom

## Content

Blog posts live in `src/content/blog/` as Markdown or MDX files. Frontmatter schema:

```yaml
---
title: "Post Title"
description: "Brief description for listings and SEO"
pubDate: 2024-01-15
updatedDate: 2024-01-16  # optional
heroImage: "./image.jpg"  # optional
---
```

## Site Config

Edit `src/consts.ts` to change:
- `SITE_TITLE`: "Sigil"
- `SITE_DESCRIPTION`: "A portfolio and music blog by Brandon Wirth"
- `SITE_AUTHOR`: "Brandon Wirth"
