# spb-seo-geo

English · **[한국어](./README.ko.md)**

An **agent skill that audits and configures a site's search and AI visibility** — Google Search Console, Bing Webmaster Tools, Naver Search Advisor, Yahoo! JAPAN, plus AI answer citation (GEO/AEO) — in one pass.

Point it at a project and it audits the live site, fixes what can be fixed in code, and hands you only the steps that genuinely require a human. **You are not interviewed first** — it reads the site address out of your project and starts.

```
npx spb-seo-geo     # install: pick only the harnesses you use, 2 questions
/spbseo             # audit everything
/spbseo seo         # classic search only
/spbseo geo         # AI citation only
```

No setup, no flags, no account. The site address comes from your framework config,
`package.json`, `public/CNAME`, `.env*` or an existing sitemap — you are asked for it only
if none of those have it.

A question appears only when it is the one thing standing between you and a fix: a
verification token you already hold (so the tag gets placed instead of listed), whether AI
companies may train on your content (robots.txt is written allow-everything otherwise),
and whether the site publishes posts regularly (worth an RSS feed, mostly for Naver).
Every answer is saved to `.spb-seo-geo.json` and never asked again.

## What makes it different

| | |
| --- | --- |
| **Code makes the verdict, not the model** | The agent never reads your HTML, robots.txt or sitemap. One audit costs about as many tokens as reading a single report, and the same site always yields the **same result** — even if you swap the model underneath. |
| **Nothing to configure** | Run it and it works. Anything discoverable from your project — the site URL, the framework, a monorepo's apps, an access log, an IndexNow key already committed — is discovered, never asked. Questions arrive one at a time, only when an answer changes what gets written, and "skip" is always fine. |
| **Finishes the job instead of listing it** | Ask for the verification tokens up front and the tool can place them, instead of printing "add this yourself". For frameworks that own `<head>`, it emits the form you can actually paste — a Next.js `metadata.verification` object, not a raw `<meta>` tag. |
| **Optional work is optional, never a failure** | Every rule runs for every site, because allowing a crawler costs nothing. Only work that needs a console account is optional, and it lands in `todo` under "Optional engines" — a site that ignores Naver never sees a Naver *failure*. Signals (`100% Hangul`, `.jp domain`) are shown as a suggestion, not a gate. |
| **Yahoo, described honestly** | Yahoo has no index of its own: **Yahoo! JAPAN runs on Google's**, and Yahoo elsewhere runs on **Bing**. So "optimise for Yahoo" is not a real task, and inventing a Yahoo rule group would mean rules with no evidence. Japan adds exactly one real check (Yahoo! JAPAN's own `Y!J-*` crawlers) plus a note pointing at the Google findings. |
| **No rule without evidence** | All 45 rules carry an evidence URL and a grade (primary = official docs, secondary = research/measurement, low = correlation only). A rule missing either is **not even loaded**. |
| **No score** | There is no defensible way to weight 45 rules into a number, so we don't. You get counts and severities. |
| **"I don't know" stays "I don't know"** | An unverifiable check (`?`) is never rounded up to a pass, and a rule skipped by market (`⏭`) is never silently hidden. |

## Install

```bash
npx spb-seo-geo                                     # interactive
npx spb-seo-geo --agent claude,codex --scope project --yes
npx spb-seo-geo --list-agents
```

- It **detects** installed harnesses but never installs everywhere on its own. You do the checking.
- Default scope is **this project**. An SEO skill only matters in a web project; installing globally costs context in every unrelated one.
- Choose several harnesses and there is still exactly **one real copy** at `.agents/skills/spbseo`; the rest are symlinks.
- Once installed, **npx and the network are no longer needed**.

| Harness | How you invoke it |
| --- | --- |
| Claude Code | `/spbseo` — the skill name *is* the command. Restart it once after installing |
| Codex CLI | **no slash command.** Codex discovers skills from `.agents/skills/` (project) and `$CODEX_HOME/skills` (global), then picks one by its description — just ask: *"check this site's SEO"*. `/skills` lists what it found |
| Gemini CLI | `/spbseo` via `.gemini/commands/spbseo.toml` |
| Antigravity | `/spbseo` via `.agent/workflows/spbseo.md` |
| Cursor · Kimi Code · Cline · Warp · Zed … | they read `.agents/skills/` |

Codex before 0.159 took a command file in `~/.codex/prompts/`; that directory no longer
exists and nothing is written there.

## Commands

```bash
node <skill>/scripts/scan.mjs   [--only seo|geo] [--verbose] [--json]     # no arguments needed
node <skill>/scripts/apply.mjs  [--write]
node <skill>/scripts/todo.mjs
node <skill>/scripts/submit.mjs [--since HEAD~1]

node <skill>/scripts/setup.mjs  [--url https://example.com] [--engines naver,yahoo|none] \
                                [--ai-policy open|cite-only|closed] [--with-rss] \
                                [--google-token X] [--bing-token X] [--naver-token X] [--write]
node <skill>/scripts/intake.mjs                                           # what is still unanswered
```

You normally reach these through `/spbseo` rather than typing them. `scan` needs nothing — everything else is there for when you want to hand it an answer it could not infer. Requires Node 20+.

- `apply` **previews by default.** Nothing changes without `--write`; existing files are backed up to `.bak`, and only the region inside the `# >>> spb-seo-geo` markers is touched.
- `submit` notifies **Bing, Naver, Yandex and Seznam** over IndexNow. Google does not participate, so it never claims otherwise.

## What gets checked (45 rules)

| Group | Count | Covers |
| --- | --- | --- |
| CORE | 18 | robots.txt · sitemap · canonical · title/description · server-rendered body text · `lang` accuracy · Open Graph · IndexNow key |
| GOOGLE | 7 | ownership · `noindex` · **`nosnippet`** · `Google-Extended` · JSON-LD · Indexing API misuse |
| BING | 3 | ownership · bingbot · registration (with the GSC-import shortcut) |
| GEO | 12 | **citation bots allowed** · training policy · user-triggered bots · **actual crawler fetches from your access log** · policy violations · text form · internal links · headings · dates · entity markup · citation signals |
| NAVER | 4 | **Yeti blocking** (checked for everyone) · ownership · RSS · console registration — the last three are optional advice, never failures |
| YAHOO | 1 | Yahoo! JAPAN's own `Y!J-*` crawlers (checked for everyone — allowing them is free) |

Every rule carries a `scope`, so `--only seo` (31 rules) and `--only geo` (24) are real splits rather than guesses — infrastructure that gates both (robots, sitemap, indexability, server-rendered text) appears in both.

Every rule runs for every site — allowing a crawler is free everywhere. Only the steps that need a console account (Naver, Yahoo! JAPAN) are optional, and those are reported as notes and routed to `todo`, never as failures.

### GEO is measured, not assumed

Pass `--access-log <file>` (nginx, Apache, Cloudflare or Vercel exports, `.gz` fine) and you get the only hard evidence in GEO — whether AI crawlers actually fetch you:

```
AI crawler activity (last 30d, ./access.log)
  citation        OAI-SearchBot 41 · Claude-SearchBot 12   (last 2026-09-27)   ← eligibility to be cited
  user-triggered  ChatGPT-User 7   (last 2026-09-28)   ← people arriving through an AI product
  training        GPTBot 88 · ClaudeBot 31
  search          Googlebot 240 · bingbot 55
```

`citation none` means nothing can cite you however good the content is. Being *allowed* in robots.txt proves nothing on its own.

What this deliberately does not do is query ChatGPT or Perplexity to see if your brand gets mentioned — that needs paid APIs or scraping, and samples one answer at one moment. Crawler evidence is deterministic, free, and closer to something you can act on.

The two that fire most often:

- **`GEO-01`** — `ClaudeBot` (training) and `Claude-SearchBot` (citation) are separate tokens. Blocking "AI training" and catching the citation bot with it makes you **disappear from AI answers entirely.**
- **`GOOGLE-03`** — with `nosnippet` or `max-snippet:0`, a page is categorically ineligible for AI Overviews citation. Google's own documentation states eligibility requires being shown "with a snippet".

## `--ai-policy`

| Preset | Training bots | Citation bots |
| --- | --- | --- |
| `open` (default) | allowed | allowed |
| `cite-only` | blocked | allowed |
| `closed` | blocked | blocked — printed with a warning that you vanish from AI answers |

`open` is the default because this tool's goal is maximum visibility. **Blocking training is a value judgment, so the user has to choose it explicitly.**

## Development

```bash
npm test              # 40 tests
npm run lint:rules    # rejects any rule lacking evidence or a grade
```

Design notes and the decision log (D1–D15) live in `PLAN.md` and in the companion research vault.

## Localisation

Code, rules, reports and `SKILL.md` are English. That does **not** mean you get English answers: agents reply in the language you write in, and `SKILL.md` instructs them to translate findings rather than paste report lines verbatim. English output is only what you see if you run the scripts directly in a terminal.

This README is also available in [한국어](./README.ko.md).

## What it refuses to nag you about

A finding you cannot act on is noise, so:

- **Rules that cannot apply are not run.** Publication dates and prose structure are only checked on pages that actually look like articles; AI-crawler measurement only runs when you give it a log. These show as `n/a` with the reason — not as "unchecked".
- **Console registration is phrased as a question, not an order**, because there is no way to see from outside whether you already did it. Tell it once with `--done GOOGLE-07` and it never asks again.
- **Images are not counted against you.** An earlier rule compared text length to image count, which punished landing pages for being landing pages. The real check — is there body text at all — is `CORE-12`.

## Verified, and not

Checked against three live sites (a Next.js monorepo, a marketing site, a Vite SPA):

- **Naver IndexNow really works** — and did not, until this was tested. Naver returned
  422 for every submission because the request carried `keyLocation`; both endpoints now
  return 200. If you used an earlier build, nothing you submitted reached Naver.
- **Runs outside Claude Code** — Codex CLI discovers the skill from `.agents/skills`,
  executes the bundled script and relays the report, including a monorepo with two sites.
  Getting there took fixing an install that wrote to `~/.codex/prompts/`, a directory
  Codex removed in 0.159 — and learning that Codex has no per-skill slash command at all.
- **Determinism holds** — the same site twice yields an identical verdict set.
- **Every citation resolves**, and the load-bearing ones were re-read against the claim
  they support. Four rules were corrected or split because their source did not say what
  they claimed.

Still open:

- Whether the very cheapest models follow `SKILL.md`. A low-reasoning run has now been
  done and relayed every count exactly, picked the right app in a monorepo, and changed
  no files — but it silently dropped the line saying GEO had not been checked, so that
  line is now phrased as a loss rather than a flag. Smaller models than that are still
  untested.
- The 20% Hangul / 5% kana thresholds for suggesting a regional engine are judgement
  calls, not measurements.
- **Gemini CLI**: the `.toml` command and the `.agents/skills` path were checked against
  the installed CLI's own bundled documentation, but `/spbseo` has not been typed there.
- **Antigravity, Cursor and the rest** are wired by path convention only. Nothing has
  been run in them. After the Codex case — where the documented command file turned out
  to target a directory that no longer exists — treat a path convention as a guess until
  someone types the command.

## License

MIT
