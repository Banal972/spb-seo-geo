# /spbseo — audit search and AI visibility

Follow the instructions in `{{SKILL_DIR}}/SKILL.md`. Do not read the site's HTML, robots.txt or sitemap yourself — run the command below and relay only its output in plain language.

```
node {{SKILL_DIR}}/scripts/scan.mjs --url <SITE>
```

Use the URL given as an argument; if there is none, ask the user. Never pass `--write` to `apply` without approval.
If the script is missing, tell the user to reinstall with `npx spb-seo-geo`.
