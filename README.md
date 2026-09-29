# spb-seo-geo

English · **[한국어](./README.ko.md)**

An **agent skill that audits and configures a site's search and AI visibility** — Google Search Console, Bing Webmaster Tools, Naver Search Advisor, Yahoo! JAPAN, plus AI answer citation (GEO/AEO) — in one pass.

Google and Bing always apply. Regional engines are **opt-in**: the skill asks once whether you want Korea (Naver) and/or Japan (Yahoo! JAPAN), remembers the answer, and never guesses on your behalf.

```
npx spb-seo-geo     # install: pick only the harnesses you use, 2 questions
/spbseo             # from then on, just this
```

## What makes it different

| | |
| --- | --- |
| **Code makes the verdict, not the model** | The agent never reads your HTML, robots.txt or sitemap. One audit costs about as many tokens as reading a single report, and the same site always yields the **same result** — even if you swap the model underneath. |
| **Regional engines, asked not guessed** | Most tools skip Korea's dominant engine entirely. This one covers Naver properly — but which countries you want traffic from is a business decision, not something readable from your HTML. So it reports the signals it saw (`100% Hangul`, `.jp domain`, a `naver-site-verification` tag) and asks. Until you answer, regional rules are listed as not evaluated rather than silently included or dropped. |
| **Yahoo, described honestly** | Yahoo has no index of its own: **Yahoo! JAPAN runs on Google's**, and Yahoo elsewhere runs on **Bing**. So "optimise for Yahoo" is not a real task, and inventing a Yahoo rule group would mean rules with no evidence. Japan adds exactly one real check (Yahoo! JAPAN's own `Y!J-*` crawlers) plus a note pointing at the Google findings. |
| **No rule without evidence** | All 37 rules carry an evidence URL and a grade (primary = official docs, secondary = research/measurement, low = correlation only). A rule missing either is **not even loaded**. |
| **No score** | There is no defensible way to weight 37 rules into a number, so we don't. You get counts and severities. |
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

| Harness | How `/spbseo` arrives |
| --- | --- |
| Claude Code | the skill name *is* the command (no file needed) |
| Codex CLI | `~/.codex/prompts/spbseo.md` |
| Gemini CLI | `.gemini/commands/spbseo.toml` |
| Antigravity | `.agent/workflows/spbseo.md` |
| Cursor · Kimi Code · Cline · Warp · Zed … | they read `.agents/skills/` |

## Commands

```bash
node <skill>/scripts/scan.mjs   --url https://example.com [--market kr|jp|kr,jp|global] [--save] [--verbose] [--json]
node <skill>/scripts/apply.mjs  --url https://example.com [--write] [--ai-policy open|cite-only|closed]
node <skill>/scripts/todo.mjs   --url https://example.com
node <skill>/scripts/submit.mjs --url https://example.com --since HEAD~1
```

You normally reach these through `/spbseo` rather than typing them. Requires Node 20+.

- `apply` **previews by default.** Nothing changes without `--write`; existing files are backed up to `.bak`, and only the region inside the `# >>> spb-seo-geo` markers is touched.
- `submit` notifies **Bing, Naver, Yandex and Seznam** over IndexNow. Google does not participate, so it never claims otherwise.

## What gets checked (39 rules)

| Group | Count | Covers |
| --- | --- | --- |
| CORE | 16 | robots.txt · sitemap · canonical · title/description · server-rendered body text · `lang` accuracy · Open Graph · IndexNow key |
| GOOGLE | 7 | ownership · `noindex` · **`nosnippet`** · `Google-Extended` · JSON-LD · Indexing API misuse |
| BING | 3 | ownership · bingbot · registration (with the GSC-import shortcut) |
| GEO | 7 | **citation bots allowed** · training-bot policy · user-triggered bots · text form · internal links · citation signals |
| NAVER | 4 | ownership · **Yeti blocking** · RSS · console registration (unverifiable) — `--market=kr` |
| YAHOO | 2 | Yahoo! JAPAN's `Y!J-*` crawlers · a note on what actually covers Yahoo — `--market=jp` |

33 of them apply everywhere. The 6 regional ones only run once you say the region applies.

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

## Not yet verified

- Bundled-script execution in Codex and Antigravity (only Claude Code confirmed)
- A real Naver IndexNow round-trip (needs a deployed site serving the key file)
- Whether cheaper models (DeepSeek, Kimi, …) actually follow `SKILL.md`
- The 20% Hangul-ratio threshold is a guess and needs tuning against real sites

## License

MIT
