# The choices, with what each one costs

Every decision the intake asks about, with what you gain and what you give up. Grades are
the same as the rules: **primary** = official engine documentation, **secondary** =
research or industry measurement, **low** = plausible but unverified.

## AI training policy — `--ai-policy`

| | `open` (default) | `cite-only` | `closed` |
| --- | --- | --- | --- |
| Training crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`…) | allowed | **blocked** | blocked |
| Citation crawlers (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) | allowed | allowed | **blocked** |
| Appears as a source in AI answers | yes | yes | **no** |
| Google/Bing/Naver search ranking | unaffected | unaffected | unaffected |

**Same either way**: search ranking. Google states `Google-Extended` covers Gemini and
Vertex *training* only and has no effect on Search indexing (primary). Blocking training
does not cost you rankings.

**What `open` buys you** — a model may absorb the brand during training and mention it
without searching. That is the "does it know us without looking it up" effect.
**Grade: low.** Nobody publishes per-site evidence for it, the benefit is invisible in
your analytics, and it is delayed by a training cycle. Treat it as a bet, not a mechanism.

**What `open` costs** — your content becomes training data. It may then be paraphrased
without a link back, and a stale version of it can persist in a model long after you
change the page.

**What `cite-only` buys you** — you stay citable in AI answers, with a link, while your
content is not absorbed into model weights. Citation and training are separate crawlers,
so this really is possible (primary). It is the honest middle and the reason the preset
exists.

**What `cite-only` costs** — the `open` bet above. And if you block `Google-Extended`,
Gemini-app grounding may drop the site (secondary — vendor behaviour here changes).

**`closed`** removes the site from AI answers entirely. Choose it only if that is the
goal; the audit will warn every time.

**Reversible?** All three are robots.txt lines. Change and redeploy — no lasting effect
either way, except that training already done cannot be undone.

## llms.txt — `--with-llms-txt`

**What it buys you** — a machine-readable index of your docs for coding agents. Anthropic
recommends it in its "Writing for Agents" guidance and both Anthropic and OpenAI use it
for the Agents SDK and the Agentic Commerce Protocol. Stripe, Cursor, Cloudflare, Vercel
and Supabase publish one. If developers point agents at your documentation, it helps them.

**What it does not buy you** — search or AI-answer visibility:

| Evidence | |
| --- | --- |
| Google, officially (2026-05-15) | not needed for AI Overviews or AI Mode — no AI text files, no special markup |
| Ahrefs, 137,000 sites (2026-05) | **97% of llms.txt files received zero traffic** |
| Bot-log analysis, 500M AI bot visits | **408 requests** targeted llms.txt directly |

**Cost** — one file, and remembering to regenerate it. Zero otherwise.

**So**: worth it for a documentation or developer-tool site. No measurable point for a
marketing site, landing page or shop. This is why the rule is `info` at grade `low` and
generation is opt-in — we will not promise an effect the data does not support.

## RSS — `--with-rss`

**What it buys you** — Naver still treats RSS as a first-class input, alongside the
sitemap, and its console has a dedicated RSS submission step (secondary). For a site that
publishes regularly this can shorten the gap between posting and being crawled. Feed
readers, Slack and Discord previews use it too.

**What it costs** — our generated feed is **static**. It reflects the pages that existed
when `apply` ran, so it goes stale unless your build regenerates it. A stale feed is worse
than none: it tells Naver nothing new is happening.

**So**: take it if content ships regularly and your build can regenerate it. Skip it for a
landing page — there is nothing to feed.

## IndexNow — part of `apply`

**What it buys you** — one key file lets you notify **Bing, Naver, Yandex and Seznam** the
moment a page changes, instead of waiting to be crawled. As of 2024 IndexNow had received
about 2.5 billion URLs, and roughly 17% of clicked URLs on Bing arrived through it
(secondary).

**What it costs** — a single file at the site root. **Google does not participate**, so it
does nothing for Google.

**So**: near-free, and it is the only programmatic way to reach Naver at all.

## Optional engines — `--engines`

| | What it adds | What it costs |
| --- | --- | --- |
| **Naver** | Korea's dominant engine, plus its AI Briefing surface (20% of queries in 2025-12, targeting ~40% by end of 2026). Four real checks | Four console steps in a fixed order, and indexing takes a couple of weeks |
| **Yahoo** | Nothing to register. **Yahoo! JAPAN runs on Google's index**, so your Google work already covers it; Yahoo elsewhere runs on Bing | Nothing. Choosing it just gets you that answer |

Content language is not the deciding factor — a `.kr` site may be going after Japan. Ask.
