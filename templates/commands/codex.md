# /spbseo — audit search and AI visibility

Follow the instructions in `{{SKILL_DIR}}/SKILL.md`. Do not read the site's HTML, robots.txt or sitemap yourself — run the command below and relay only its output in plain language.

```
node {{SKILL_DIR}}/scripts/scan.mjs
```

It needs no arguments: the site address is read out of the project. Append whatever the user typed after `/spbseo` — `seo`, `geo`, or an address — and ask for an address only if the scan reports it could not find one. Never pass `--write` to `apply` without approval.
If the script is missing, tell the user to reinstall with `npx spb-seo-geo`.
