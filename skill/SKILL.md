---
name: spbseo
description: Audits and configures a site's search and AI visibility (SEO/GEO). Use it when pages are not showing up in search, right after a deploy, for Google Search Console / Bing / Naver Search Advisor / Yahoo! JAPAN setup, for robots.txt, sitemaps, RSS, IndexNow, canonical, Open Graph and indexing checks, and to make a site citable by AI answer engines.
---

# spbseo — audit and configure search + AI visibility

The scripts bundled with this skill make the verdict. **You gather a few answers, run a command, and translate the result into plain language.** `<DIR>` = the directory holding this SKILL.md.

## Never do this

- Do **not** fetch or read the site's HTML, robots.txt or sitemap yourself. The script already judged them.
- Do not web-search for SEO advice. Every rule carries its evidence URL.
- Do not invent a score. Report counts and severities.
- Do not enumerate passing rules. Say `✅ N pass` in one line.
- Never pass `--write` without the user's approval.
- Do not present `n/a` items as work — they do not apply here.
- Do not volunteer timelines, caveats or background nobody asked for.
- Do not order someone to register with a console: `GOOGLE-07`, `BING-03` and `NAVER-04` are unverifiable from outside, so say "if you have not yet" and run `--done <ID>` once they confirm.

## Start by asking — one question at a time

```
node <DIR>/scripts/intake.mjs
```

This prints what is already known and what is still unanswered, in order. **Ask the user those questions one at a time and wait for each answer** — do not dump them all at once, and do not answer them yourself.

The order matters: **which site** (a monorepo often holds several — never pick one yourself), then the address, then Naver, then Yahoo, then the AI training policy, then verification tokens, then an access log, then optional files. Anything already saved in `.spb-seo-geo.json` is skipped, so this is a first-run conversation, not a recurring one.

The site URL is usually already in the project, so that question is a confirmation rather than an open one. Save every answer in one `setup` call (intake prints the exact command) and show the file preview before writing anything.

Later runs need no flags:

```
node <DIR>/scripts/scan.mjs   [--only seo|geo] [--verbose] [--json]
node <DIR>/scripts/apply.mjs  [--write]
node <DIR>/scripts/todo.mjs
node <DIR>/scripts/submit.mjs [--since HEAD~1]
```

`--only seo` (30 rules) · `--only geo` (24) · default both (44); what `--only` leaves out is stated. Needs Node 20+ — if missing, say so in one line and stop.

## Order of work

1. **`intake`** → ask one at a time → **`setup`** (no `--write`): shows the audit and the file preview.
2. On approval, **`setup --write`** — or `apply --write` on later runs.
3. Relay **`todo`** as given: required steps first, optional engines after.
4. After they deploy, **`scan`** again against the live site.
5. On new pages, **`submit`**. Google does not participate in IndexNow — never claim otherwise.

## Language

**Answer in whatever language the user writes in.** The report is an intermediate artifact — translate its findings rather than pasting lines. Keep rule IDs, user agents and paths as-is.

## Reading the report

| Symbol | Relay it as |
| --- | --- |
| `✅` pass | count only |
| `⚠️` warning | count, detail on request |
| `·` note | count only — weaker evidence or optional |
| `❌` critical | **always explain.** Something is blocking visibility |
| `?` unchecked | **not a pass.** Say why it could not be checked |
| `⏭` hidden | one line; never drop it silently |
| `n/a` | does not apply (no access log, not an article site). **Not a defect** |
| `✔` | the user already said it was done |

`[evidence: primary]` = official engine docs · `secondary` = research/measurement · `low` = correlation only. **Relay the grade as given.**

Exit codes: `0` clear · `1` critical · `2` warnings · `3` error

## Optional engines

Nothing is gated — allowing a crawler is free, so every rule runs regardless. Only console work is optional; `todo` prints it under "Optional engines".

**Never infer an engine from the site's language.** Content says what language it is written in, not which markets its owner wants — a `.kr` site may be going after Japan. Ask about each engine, and pass what the user says: `--engines naver,yahoo` or `--engines none`. Yahoo's answer is "nothing to register" — relay what `todo` prints.

## Read only when you need detail

`<DIR>/references/` — `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## Two things the audit already handles for you

- **If a plugin generates `robots.txt`** (`next-sitemap` and friends), `apply` prints the snippet for *that tool's config* instead of writing a file the next build would overwrite. Relay the snippet as the fix.
- **Something already in the repo but not deployed** reads as "exists locally, deploy it", not as missing. Never tell someone to create what they already created.

## GEO is measured, not assumed

With an access log the report prints an **AI crawler activity** block: which citation bots fetched the site, and whether a real person arrived through an AI product. Relay it — it is the hardest data in the report. `citation none` means nothing can cite the site however good its content is.

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens; blocking the citation bot removes the site from AI answers.
- **`GOOGLE-03`** — `nosnippet` or `max-snippet:0` makes a page categorically ineligible for AI Overviews citation.
