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
- Do not order someone to register with a console: `GOOGLE-07`, `BING-03`, `NAVER-04` are unverifiable from outside — say "if you have not yet", then `--done <ID>` once they confirm.

## Auditing needs nothing; configuring needs answers

Only want to know how the site is doing? Run `scan` — no questions, every rule still runs.
The intake exists because this tool also **writes**, and each question decides what:

| Question | Decides |
| --- | --- |
| verification tokens | whether we place the ownership tag or just tell you to fetch it |
| AI training policy | what goes into robots.txt |
| access log | whether crawler activity is measured at all |
| RSS / llms.txt | whether those files get generated |

A question that changes neither what is written nor what is evaluated does not belong —
that test is what removed the engine questions.

## The intake — one question at a time

```
node <DIR>/scripts/intake.mjs
```

It prints what is known, what is unanswered, and **the tradeoff for each choice**. Ask one at a time and wait — never as a form, never answering for them, and **always give the cost with the option**. `references/choices.md` has the evidence if they dig.

Order: **which site** (a monorepo often holds several — never pick one yourself), address, then the four above. The address is usually already in the project, so that one is a confirmation. Anything saved in `.spb-seo-geo.json` is skipped — a first-run conversation, not a recurring one.

Save the answers in one `setup` call (intake prints it) and show the file preview before writing.

Later runs need no flags:

```
node <DIR>/scripts/scan.mjs   [--only seo|geo] [--verbose] [--json]
node <DIR>/scripts/apply.mjs  [--write]
node <DIR>/scripts/todo.mjs
node <DIR>/scripts/submit.mjs [--since HEAD~1]
```

`--only seo` (30) · `--only geo` (24) · default both (44); what it leaves out is stated. Needs Node 20+ — if missing, say so and stop.

## Order of work

**`intake`** → ask one at a time → **`setup`** (no `--write`, shows audit + file preview) → on approval **`setup --write`** → relay **`todo`** as given → after they deploy, **`scan`** again → on new pages, **`submit`** (Google does not participate in IndexNow — never claim otherwise).

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

## Optional engines

Console work for Naver and Yahoo is the only optional part; `todo` prints it under "Optional engines", with both always listed. **Never infer an engine from the site's language** — content says what language it is in, not which markets its owner wants, and a `.kr` site may be going after Japan. Yahoo's answer is "nothing to register"; relay what `todo` prints.

## Read only when you need detail

`<DIR>/references/` — `choices.md` (what each decision costs) · `google.md` · `naver.md` · `bing.md` · `yahoo.md` · `geo.md`

## Three things the audit already handles

- **If a plugin generates `robots.txt`**, `apply` prints the snippet for *that tool's config* rather than writing a file the next build overwrites. Relay the snippet.
- **Already in the repo but not deployed** reads "exists locally, deploy it", not missing.
- **If the site could not be reached**, everything live is unchecked — never report that as failures.

## GEO is measured, not assumed

With an access log the report prints an **AI crawler activity** block: which citation bots fetched the site, and whether a real person arrived through an AI product. Relay it — it is the hardest data in the report. `citation none` means nothing can cite the site however good its content is.

## The two that come up most

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens; blocking the citation bot removes the site from AI answers.
- **`GOOGLE-03`** — `nosnippet` or `max-snippet:0` makes a page categorically ineligible for AI Overviews citation.
