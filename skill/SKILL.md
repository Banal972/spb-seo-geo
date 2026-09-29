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

## Just run it — no questions needed

```
node <DIR>/scripts/scan.mjs
```

No flags. It finds the site URL from the project — framework config, `package.json` `homepage`, `public/CNAME`, `.env*`, an existing `sitemap.xml`/`robots.txt` — plus an access log if one sits in the repo. The report says where the URL came from. **Ask for the URL only if it was not found.**

Narrow it when the user cares about one side only: `--only seo` (30 rules) · `--only geo` (24) · default both (44). Whatever `--only` leaves out is stated, never silently dropped.

## Ask only for what unlocks something

Each of these buys a concrete capability. Ask when you reach it, not up front — and never ask for something the project already told us.

| Ask for | Unlocks |
| --- | --- |
| **Verification tokens** (the "HTML tag" string from each console) | `apply` places the ownership tags instead of telling them to |
| **An access log** (`--access-log`, `.gz` fine) | GEO goes from "allowed" to **measured** — which AI crawlers actually fetched |
| `--ai-policy open\|cite-only\|closed` | only if they care about AI training; `open` is the default |
| `--engines naver,yahoo\|none` | only to hide optional console advice; nothing is gated on it |

Save answers once so later runs need no flags:

```
node <DIR>/scripts/setup.mjs [--url X] [--google-token X] [--bing-token X] [--naver-token X] \
     [--access-log path] [--ai-policy …] [--engines …] [--with-rss] [--with-llms-txt] [--write]
```

`setup` saves, then runs scan + apply preview + todo in one pass.

```
apply.mjs  [--write]          configure files
todo.mjs                      what only a human can do
submit.mjs [--since HEAD~1]   tell IndexNow about new pages
```

Needs Node 20+; if missing, say so in one line and stop.

## Order of work

1. **`scan`** with no flags. Show the failures; say where the URL came from.
2. **`apply`** to preview, then `apply --write` on approval.
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
| `n/a` | does not apply here (no access log, or not an article site). **Not a defect — do not present it as one** |
| `✔` | the user already told us it was done |

`[evidence: primary]` = official engine docs · `secondary` = research/measurement · `low` = correlation only. **Relay the grade as given.**

Exit codes: `0` clear · `1` critical · `2` warnings · `3` error

## Optional engines

Every rule runs for every site — allowing a crawler costs nothing, so nothing is gated. Only console work is optional, and `todo` prints it under "Optional engines", including the full answer for Yahoo (short version: nothing to register — Yahoo! JAPAN runs on Google's index). Relay what `todo` says rather than improvising.

## Read only when you need detail

`<DIR>/references/` — `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## GEO is measured, not assumed

With an access log the report prints an **AI crawler activity** block: which citation bots fetched the site and when, plus whether a real person arrived through an AI product (`ChatGPT-User` and friends — the strongest evidence there is). Relay that block; it is the hardest data in the report. `citation none` means nothing can cite the site however good the content is — lead with it.

## Do not nag

- Console registration (`GOOGLE-07`, `BING-03`, `NAVER-04`) **cannot be checked from outside** — the user may well have done it already. Phrase it as "if you have not yet", and when they say it is done, run `--done GOOGLE-07,BING-03` once; it is saved and never raised again.
- `n/a` items are not findings. Do not list them as work.
- Do not volunteer timelines, caveats or background the user did not ask for. Report what was found and what to do.

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens; blocking the citation bot removes the site from AI answers.
- **`GOOGLE-03`** — `nosnippet` or `max-snippet:0` makes a page categorically ineligible for AI Overviews citation.
