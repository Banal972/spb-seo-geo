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

## Intake — ask before the first run

If `.spb-seo-geo.json` does not exist yet, ask for these **first**, in one message. They cannot be inferred, and with them in hand the setup finishes in one pass instead of handing half the work back.

1. **Site URL** — required.
2. **Whether to add Naver and/or Yahoo** — ask by engine name, not by country. Google and Bing always apply. `--engines naver,yahoo` or `--engines none`.
3. **Verification tokens they already have** — the string from each console's "HTML tag" option. Skipping a console they have not signed up for is fine.
4. **AI training policy** — `open` (default, max visibility), `cite-only` (block training, stay citable), `closed` (block both — warn that this removes the site from AI answers).
5. **An access log if they can get one** (`--access-log <file>`, `.gz` fine) — the only way to know whether AI crawlers actually fetch the site.
6. Optional: `--with-rss` (for Naver), `--with-llms-txt` (which Google says is unnecessary).

Then run setup. Without `--write` it changes nothing and shows a preview:

```
node <DIR>/scripts/setup.mjs --url <SITE> [--engines naver,yahoo|none] [--ai-policy open|cite-only|closed] \
     [--google-token X] [--bing-token X] [--naver-token X] [--with-rss] [--with-llms-txt] [--write]
```

Everything is saved, so later runs need no flags:

```
node <DIR>/scripts/scan.mjs   [--verbose] [--json]   audit only
node <DIR>/scripts/apply.mjs  [--write]              configure files
node <DIR>/scripts/todo.mjs                          what only a human can do
node <DIR>/scripts/submit.mjs [--since HEAD~1]       tell IndexNow about new pages
```

Needs Node 20+; if missing, say so in one line and stop.

## Order of work

1. **Intake → `setup`** (no `--write`): show the failures and the file preview.
2. On approval, **`setup --write`** — or `apply --write` later.
3. Relay **`todo`**: required console steps first, then optional engines. Keep the order and the ~2-week Naver delay as given.
4. After they deploy, **`scan`** again against the live site.
5. On new pages, **`submit`**. Google does not participate in IndexNow — never claim otherwise.

## Language

**Answer in whatever language the user writes in.** The report is an intermediate artifact, not the answer — translate its findings rather than pasting lines verbatim. Keep rule IDs, user-agent names and paths as-is.

## Reading the report

| Symbol | Relay it as |
| --- | --- |
| `✅` pass | count only |
| `⚠️` warning | count, detail on request |
| `·` note | count only — weaker evidence or optional |
| `❌` critical | **always explain.** Something is blocking visibility |
| `?` unchecked | **not a pass.** Say why it could not be checked |
| `⏭` hidden | one line; never drop it silently |

`[evidence: primary]` = official engine docs · `secondary` = research/measurement · `low` = correlation only. **Relay the grade as given.**

Exit codes: `0` clear · `1` critical · `2` warnings · `3` error

## Optional engines

Every rule runs for every site — allowing a crawler costs nothing, so nothing is gated. Only console work is optional, and `todo` prints it under "Optional engines", including the full answer for Yahoo (short version: nothing to register — Yahoo! JAPAN runs on Google's index). Relay what `todo` says rather than improvising.

## Read only when you need detail

`<DIR>/references/` — `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## GEO is measured, not assumed

With an access log the report prints an **AI crawler activity** block: which citation bots fetched the site and when, plus whether a real person arrived through an AI product (`ChatGPT-User` and friends — the strongest evidence there is). Relay that block; it is the hardest data in the report. `citation none` means nothing can cite the site however good the content is — lead with it.

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens; blocking the citation bot removes the site from AI answers.
- **`GOOGLE-03`** — `nosnippet` or `max-snippet:0` makes a page categorically ineligible for AI Overviews citation.
