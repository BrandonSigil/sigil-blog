# Stashed: studio / freelance work content

Tucked away on 2026-11-21 when the site became music-only. Nothing in this folder is built or
deployed: Astro only builds `src/` and `public/`, and `tsconfig.json` excludes `stash/`.

The folder mirrors the paths the files came from, so each one can be moved straight back.

## What is here

| File | What it was |
| --- | --- |
| `src/pages/portfolio.astro` | The `/portfolio` work page |
| `src/components/WorkProjectRow.astro` | A project row on the work page |
| `src/components/ProjectImageSlider.astro` | The image slider inside each project row |
| `src/components/LogoMarquee.astro` | The scrolling client-logo marquee in the homepage hero |
| `src/assets/work/*.svg` | The client logos the marquee used |
| `src/pages/about.astro` | The studio About page (process, services, "See our work" link) |
| `src/pages/index.astro` | Homepage as it was, with the marquee and studio structured data |
| `src/pages/404.astro` | 404 page as it was, with the "See our work" link |
| `src/consts.ts` | Site constants as they were (`SITE_STUDIO`, studio description) |

The last four are reference copies. The live versions of those files still exist in `src/`,
rewritten around music.

## Bringing it back

1. Move `portfolio.astro`, the three components, and `assets/work/` back to the same paths under `src/`.
2. Put `export const SITE_STUDIO = 'Sigil Studios';` back in `src/consts.ts` (the stashed pages import it).
3. Re-add `<LogoMarquee />` to the homepage hero and a link to `/portfolio` where you want one,
   using the stashed `index.astro`, `about.astro` and `404.astro` as the reference.
