---
name: spbseo
description: Audits and configures a site's search and AI visibility (SEO/GEO). Use it when pages are not showing up in search, right after a deploy, for Google Search Console / Naver Search Advisor / Bing registration, for robots.txt, sitemaps, RSS, IndexNow, canonical, Open Graph and indexing checks, and to make a site citable by AI answer engines.
---

# spbseo — audit and configure search + AI visibility

The scripts bundled with this skill make the verdict. **You run a command and translate the result into plain language.**

## Never do this

- Do **not** fetch or read the site's HTML, robots.txt or sitemap.xml yourself. The script already judged them.
- Do not web-search for SEO advice. Every rule carries its evidence URL in the catalog.
- Do not invent a score. Report counts and severities only.
- Do not enumerate passing rules. Say `✅ N pass` in one line.

## Commands

Run them relative to this skill folder. `<DIR>` = the directory holding this SKILL.md.

```
node <DIR>/scripts/scan.mjs   --url <SITE> [--dir <project>] [--market auto|kr|global] [--verbose] [--json]
node <DIR>/scripts/apply.mjs  --url <SITE> [--write] [--ai-policy open|cite-only|closed]
                              [--google-token X] [--naver-token X] [--bing-token X] [--with-llms-txt]
node <DIR>/scripts/todo.mjs   --url <SITE>
node <DIR>/scripts/submit.mjs --url <SITE> [--urls a,b | --since HEAD~1]
```

Requires Node 20+. If it is missing, say so in one line and stop.

## Order of work

1. **`scan`** — always start here. If no deployed URL is known, ask the user; without it the remote rules stay unchecked.
2. Explain the failures (`❌`) in plain language. Report warnings and notes as counts, and use `--verbose` only when the user wants detail.
3. **`apply`** — run it plain first to show the diff, then add `--write` once the user approves. Never pass `--write` without approval.
4. **`todo`** — work only a human can do in the consoles. Pass along the order, the time estimates and the indexing delay as given.
5. **`submit`** — after deploying new pages, notify IndexNow. Google does not participate, so never claim you notified Google.

## Reading the report

| Symbol | Meaning | How to relay it |
| --- | --- | --- |
| `✅` | pass | count only |
| `⚠️` | warning | count, plus detail on request |
| `·` | note | count only; these rest on weaker evidence |
| `❌` | critical failure | **always explain it.** Something is blocking visibility |
| `?` | could not check | **not a pass.** Pass along why it could not be checked |
| `⏭` | skipped | not evaluated because it does not apply. Mention it in one line; never hide it |

- `[evidence: primary]` = official search-engine documentation · `secondary` = research or industry measurement · `low` = correlation only. **Relay the grade as given.**
- Exit codes: `0` all clear · `1` critical present · `2` warnings only · `3` execution error

## market — decides whether Naver is checked

The report states the verdict and its basis as a sentence. If it is `undecided` (for example a freshly deployed site), **ask the user once**: "Does this site target Korean users?"

- Yes → re-run with `--market=kr`. The answer is stored in `.spb-seo-geo.json` so it is never asked again.
- No → `--market=global`. Only the 4 Naver-only rules drop out; the other 33 still run.

## Read these only when you need detail (not before)

- `<DIR>/references/google.md` — Google, AI Overviews citation eligibility, snippet controls
- `<DIR>/references/naver.md` — Search Advisor order, Yeti, RSS, the two-week delay
- `<DIR>/references/bing.md` — Bing ownership, the GSC-import shortcut
- `<DIR>/references/geo.md` — AI crawler user agents, training vs citation, evidence grades

## The two that come up most

- **`GEO-01` citation bots blocked** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens. Blocking the citation bot removes the site from AI answers entirely. This is the most expensive mistake in the catalog.
- **`GOOGLE-03` snippets suppressed** — with `nosnippet` or `max-snippet:0`, the page is categorically ineligible for AI Overviews citation.
