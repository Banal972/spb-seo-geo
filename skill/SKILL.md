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
2. **Whether to add Naver and/or Yahoo.** Google and Bing always apply — ask only about these two, by name, not by country. `--engines naver,yahoo` or `--engines none`.
3. **Verification tokens they already have** — from each console's "HTML tag" option. They can skip any console they have not signed up for yet.
4. **AI training policy** — `open` (default, maximum visibility), `cite-only` (block training, stay citable), `closed` (block both — warn that this removes the site from AI answers).
5. Optional extras: `--with-rss` (mainly for Naver), `--with-llms-txt` (which Google says is unnecessary).

Then run setup. Without `--write` it changes nothing and shows a preview:

```
node <DIR>/scripts/setup.mjs --url <SITE> [--engines naver,yahoo|none] [--ai-policy open|cite-only|closed] \
     [--google-token X] [--bing-token X] [--naver-token X] [--with-rss] [--with-llms-txt] [--write]
```

Everything is saved, so later runs need no flags:

```
node <DIR>/scripts/scan.mjs     [--verbose] [--json]     audit only
node <DIR>/scripts/apply.mjs    [--write]                configure files
node <DIR>/scripts/todo.mjs                              what only a human can do
node <DIR>/scripts/submit.mjs   [--since HEAD~1]         tell IndexNow about new pages
```

Requires Node 20+. If it is missing, say so in one line and stop.

## Order of work

1. **Intake → `setup`** (no `--write`). Show the failures and the file preview.
2. On approval, **`setup --write`** — or `apply --write` later.
3. Relay **`todo`**: the required console steps first, then the optional engine ones. Pass along the order and the ~2-week Naver indexing delay as given.
4. After the user deploys, **`scan`** again to confirm against the live site.
5. When they publish new pages, **`submit`**. Google does not participate in IndexNow — never claim you notified Google.

## Language

**Answer in whatever language the user writes in.** The report is an intermediate artifact, not the answer — translate its findings rather than pasting lines verbatim. Keep rule IDs, user-agent names and paths as-is.

## Reading the report

| Symbol | Meaning | How to relay it |
| --- | --- | --- |
| `✅` | pass | count only |
| `⚠️` | warning | count, plus detail on request |
| `·` | note | count only; weaker evidence or optional |
| `❌` | critical failure | **always explain it.** Something is blocking visibility |
| `?` | could not check | **not a pass.** Say why it could not be checked |
| `⏭` | hidden by the engine selection | mention in one line; never hide it |

`[evidence: primary]` = official search-engine documentation · `secondary` = research or industry measurement · `low` = correlation only. **Relay the grade as given.**

Exit codes: `0` all clear · `1` critical present · `2` warnings only · `3` execution error

## Optional engines

Every rule runs for every site — allowing a crawler costs nothing, so nothing is gated. Only the work that needs a console account is optional, and it appears in `todo` under "Optional engines".

- **Naver** — real work: ownership, RSS, and console submissions that must be done in order.
- **Yahoo** — the honest answer is that there is nothing to register. **Yahoo! JAPAN web search runs on Google's index**, so the GOOGLE findings already cover it and you submit through Search Console; Yahoo elsewhere runs on Bing. Say exactly that if the user asks for Yahoo — `todo` prints it for you.

## Read only when you need detail

`<DIR>/references/` — `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens. Blocking the citation bot removes the site from AI answers entirely.
- **`GOOGLE-03`** — with `nosnippet` or `max-snippet:0` a page is categorically ineligible for AI Overviews citation.
