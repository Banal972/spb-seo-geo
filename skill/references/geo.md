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
