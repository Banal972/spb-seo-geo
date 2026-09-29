---
name: spbseo
description: Audits and configures a site's search and AI visibility (SEO/GEO). Use it when pages are not showing up in search, right after a deploy, for Google Search Console / Bing / Naver Search Advisor / Yahoo! JAPAN setup, for robots.txt, sitemaps, RSS, IndexNow, canonical, Open Graph and indexing checks, and to make a site citable by AI answer engines.
---

# spbseo — audit and configure search + AI visibility

The scripts bundled with this skill make the verdict. **You gather a few answers, run a command, and translate the result into plain language.** `<DIR>` = the directory holding this SKILL.md.

## Never do this

- Do **not** read the site's HTML, robots.txt or sitemap — in the repo or over the network. The script already judged them. Do not read these scripts either: run them.
- Do not web-search for SEO advice. Every rule carries its evidence URL.
- Do not invent a score, and do not invent a recommendation. When a choice has options, give the tradeoff and stop — never mark one "recommended" or claim what most people pick. `--ai-policy` defaults to `open`; list it first.
- Do not enumerate passing rules. Say `✅ N pass` in one line.
- Never pass `--write` without the user's approval.
- **Assume they do not know SEO.** Never use a term without saying what it is, never make them go look something up, and never ask a question whose answer requires knowing the answer. "Skip if unsure" is always an acceptable reply.
- Do not present `n/a` items as work — they do not apply here.
- Do not volunteer timelines, caveats or background nobody asked for.
- Do not order someone to register with a console: `GOOGLE-07`, `BING-03`, `NAVER-04` are unverifiable from outside — say "if you have not yet", then `--done <ID>` once they confirm.

## Start here — no questions

```
node <DIR>/scripts/scan.mjs
```

The whole first step. It digs the site URL out of the project and audits the live site
against 45 rules. Ask for the URL only if it says it found none, and pick between sites
only in a monorepo holding several — `intake.mjs` lists them; **choose nothing yourself,
and run nothing else until they answer.**

Whatever the user typed after `/spbseo` goes on the end: `seo`, `geo` or a bare address.

Report the failures in plain language, then offer to fix the autofixable ones.

## Then fix, asking only what a fix needs

```
node <DIR>/scripts/apply.mjs            preview — changes nothing
node <DIR>/scripts/apply.mjs --write    after they approve the preview
node <DIR>/scripts/todo.mjs             what only a human can do, with links
node <DIR>/scripts/submit.mjs [--since HEAD~1]
```

**Do not interview them up front.** Ask one of these only when it is the thing standing
between them and a fix; "skip" is always a fine answer:

| Ask, when it comes up | Because |
| --- | --- |
| the "HTML tag" string from a console | otherwise the ownership tag is a to-do instead of being placed |
| may AI companies learn from your content? | robots.txt is written allow-everything unless they say otherwise; ranking is identical either way |
| does this site publish posts regularly? | if so `--with-rss` is worth it, mainly for Naver |
| is there a server log file? | `--access-log` turns GEO from "allowed" into measured. Most do not have one |

Answers are saved, so nothing is asked twice. `intake.mjs` prints what is unanswered.

## Language

**Answer in whatever language the user writes in.** The report is an intermediate artifact — translate its findings rather than pasting lines. Keep rule IDs, user agents and paths as-is.

## Reading the report

| | Relay it as |
| --- | --- |
| `✅` pass | count only |
| `⚠️` warn | count, detail on request |
| `·` note | count only — weak evidence or optional |
| `❌` critical | **always explain.** Visibility is blocked |
| `?` unchecked | **not a pass.** Say why |
| `⏭` hidden · `n/a` | one line each; `n/a` is **not a defect** |
| `✔` | the user already said it was done |

`[evidence: primary]` = official engine docs · `secondary` = research/measurement · `low` = correlation only. **Relay the grade as given.**

Exit codes: `0` clear · `1` critical · `2` warnings · `3` error

## How it behaves

It never writes a file another tool generates, never reports something already in the repo as missing, and never treats an unreachable site as failures. Given an access log it prints an **AI crawler activity** block — the hardest data in the report; relay it, and `citation none` means nothing can cite the site however good its content is. Details in `references/behaviour.md`.

## Read only when you need detail

`<DIR>/references/` — `behaviour.md` · `choices.md` (what each decision costs) · `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens; blocking the citation bot removes the site from AI answers.
- **`GOOGLE-03`** — `nosnippet` or `max-snippet:0` makes a page categorically ineligible for AI Overviews citation.
