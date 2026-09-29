# GEO — citation in AI answers

## The most expensive mistake: blocking training and citation together

**They are separate tokens.**

| Category | User agents | Blocking them means |
| --- | --- | --- |
| Training | `GPTBot` `ClaudeBot` `Google-Extended` `Applebot-Extended` `CCBot` `meta-externalagent` `Bytespider` | excluded from training (unrelated to search visibility) |
| **Citation** | `OAI-SearchBot` `Claude-SearchBot` `PerplexityBot` | **you disappear from AI answers entirely** |
| User-triggered | `ChatGPT-User` `Claude-User` `Perplexity-User` | users cannot open your link from inside an AI product |

Reaching for "block AI training" and catching `Claude-SearchBot` along with `ClaudeBot` is a common accident. That is why `GEO-01` is critical.
Several vendors state that user-triggered fetchers may not strictly honour robots.txt, since a person initiated the request.

## `--ai-policy` presets

| Preset | Training | Citation | User-triggered |
| --- | --- | --- | --- |
| `open` (**default**) | allowed | allowed | allowed |
| `cite-only` | **blocked** | allowed | allowed |
| `closed` | blocked | blocked | blocked |

`open` is the default because this tool's goal is maximum visibility. **Blocking training is a value judgment, so the user must choose it explicitly.** When `closed` is selected, relay the warning that the site disappears from AI answers.

## Measuring it, not guessing

Pass `--access-log <file>` and the audit reports what actually happened rather than what is theoretically allowed:

| Family | What it proves |
| --- | --- |
| `OAI-SearchBot` `Claude-SearchBot` `PerplexityBot` `Applebot` | **Eligibility.** A page nobody fetched cannot be cited, whatever robots.txt says (`GEO-08`) |
| `ChatGPT-User` `Claude-User` `Perplexity-User` | **A real person opened your link inside an AI product** — the strongest evidence AI answers send traffic (`GEO-09`) |
| `GPTBot` `ClaudeBot` `CCBot` `Google-Extended` … | Training only. Irrelevant to citation either way |
| `Googlebot` `bingbot` `Yeti` `Y!J-` | Classic search, for comparison |

`GEO-10` compares the log against robots.txt: a training or citation bot fetching paths it was disallowed from means the policy is not actually being honoured, and you need to block at the edge. User-triggered fetchers are expected to ignore robots.txt by design — that is not a violation.

What this deliberately does **not** do: query ChatGPT or Perplexity to see whether the brand is mentioned. That needs paid APIs or scraping, and it samples one answer at one moment. Crawler evidence is deterministic, free, and closer to the thing you can act on.

## Content structure (deterministic, so it is checked)

| Rule | Why |
| --- | --- |
| `GEO-11` headings | Retrieval chunks a page along its headings. One `h1`, no skipped levels, unambiguous passage boundaries |
| `GEO-12` dates | An undated page is hard to cite with confidence; answer engines weigh recency |
| `GEO-13` entity | An answer attributes a claim to someone. `Organization`/`Person` with `sameAs` is how you become that someone. Google says schema is not *required* for AI features — attribution is a different problem from eligibility |

## Evidence grades — relay them as given

| Action | Effect | Grade |
| --- | --- | --- |
| stay indexed **with snippets allowed** | the precondition for AI Overviews citation | **primary** (Google docs) |
| findable through internal links | Google recommendation | **primary** |
| keep content in textual form | Google recommendation | **primary** |
| allow citation bots | vendor UA documentation | primary/secondary |
| quotations +41% · statistics +32% · inline citations +30% | Princeton GEO study (2024) | secondary |
| lists and structured elements | ~80% of AI-cited pages use them — **correlation** | low |
| third-party trust signals | direction only. **Do not quote the multiplier** | low |

## llms.txt

- Google, officially: **not needed** for AI features
- Ahrefs (2026-05): of 137,000 sites, **97% of llms.txt files saw zero traffic**
- across 500M AI bot visits, only **408 requests** targeted llms.txt directly
- the other side: Anthropic and OpenAI recommend and use it **as agent-facing documentation**

So it is not a ranking lever. Generate it only with `--with-llms-txt`, and **never promise an effect**.
