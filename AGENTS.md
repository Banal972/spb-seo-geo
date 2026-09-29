# spb-seo-geo

This repository is an **agent skill**. Five lines for agents that do not support the skill format:

- Audit search and AI visibility (SEO/GEO): `node skill/scripts/scan.mjs --url <SITE>`
- Full instructions live in `skill/SKILL.md` — read that.
- Do not fetch or read the site's HTML, robots.txt or sitemap yourself; the script judges them.
- Never pass `--write` to `apply` without the user's approval.
- Install: `npx spb-seo-geo`
