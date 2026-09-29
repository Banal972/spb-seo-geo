# Google — Search and AI features

Primary source: https://developers.google.com/search/docs/appearance/ai-features (2026-05-15)

## The precondition for AI Overviews / AI Mode citation

> "a page must be indexed and eligible to be shown in Google Search **with a snippet**, fulfilling the Search technical requirements."

So **if snippets are suppressed, the page cannot be cited in AI answers.** That is why `GOOGLE-03` is critical.

What suppresses snippets:

- `<meta name="robots" content="nosnippet">`
- `max-snippet:0`
- `data-nosnippet` wrapped around the whole body
- the same directives delivered via the `X-Robots-Tag` header

These often linger from older SEO advice or a CMS default. Checking for them is far more consequential than writing an llms.txt.

## What Google explicitly calls unnecessary

> "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add."

- llms.txt → not needed (we carry it as `CORE-11`, info severity, low grade)
- content chunking → not needed
- AI-specific schema → not needed

## What Google does recommend

- crawlability (robots.txt)
- **make content findable through internal links** → `GEO-05`
- keep content in textual form → `GEO-04`
- good page experience

## Controls

`nosnippet` · `data-nosnippet` · `max-snippet` · `noindex`

`Google-Extended` covers Gemini and Vertex **training only** and is **unrelated to Search indexing**. Blocking it does not change search visibility (`GOOGLE-04`).

## API quotas (reference only — unused in this version)

| API | Limit |
| --- | --- |
| Search Analytics | 25,000 rows/request · 50,000/day |
| URL Inspection | **2,000 QPD** — built for targeted checks, not bulk crawling |
| Sitemaps | submit, list, diagnose |
| Indexing API | **JobPosting and BroadcastEvent only** · 200/day |

`GOOGLE-06` greps the local project for Indexing API usage. For ordinary pages the answer is a sitemap plus internal links.

## Ownership verification

`<meta name="google-site-verification" content="...">` · HTML file · DNS TXT.
A missing meta tag does not prove the site is unverified (it may be verified by file or DNS), so the verdict is `?`, not a failure.
