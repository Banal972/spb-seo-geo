# Naver — the engine with no public API

Guide: https://searchadvisor.naver.com/guide

Naver is included so this tool is useful in Korea too. Everything here is gated behind `market=kr`.

## What can and cannot be checked

| Rule | How | Possible? |
| --- | --- | --- |
| `NAVER-01` ownership | `naver-site-verification` meta in `<head>` | partly — invisible if verified by file |
| `NAVER-02` Yeti blocked | parse robots.txt and evaluate it **as Yeti would** | yes |
| `NAVER-03` RSS | `<link rel=alternate>`, else probe 6 conventional paths | yes |
| `NAVER-04` console registration/submission | **nothing — permanently `unknown`** | no |

Every route to checking `NAVER-04` was rejected:

- Search Advisor API: does not exist
- browser automation of the console: terms of service, credential handling, fragile UI
- **Naver Search API**: migrating and sunsetting (the developer-center method runs only until 2027-06-30). We do not build features on an API with a shutdown date.
- scraping search results: against the terms

## Console order (skip the order and nothing takes effect)

1. Register the site and verify ownership — if the meta tag is in place, just press Verify
2. **Submit the RSS feed** — Naver still treats RSS as a first-class input
3. Submit the sitemap
4. ⏳ **Indexing takes about two weeks.** Not appearing during that window is normal — always tell the user this

Naver itself recommends organic crawling via sitemaps over forced recrawl requests. That is why `submit` sends only changed URLs and skips anything resubmitted within 24 hours.

## IndexNow

Naver has supported it since 2023-07. It is **the only programmatic way to notify Naver.**

- endpoint: `https://searchadvisor.naver.com/indexnow`
- the shared `https://api.indexnow.org/indexnow` covers Bing, Yandex and Seznam
- host `{key}.txt` at the root, containing the key string · max 10,000 URLs per request
- **Google does not participate**

The key file is not Naver-specific, so it is classified as `CORE-16`.

## AI Briefing

Launched 2025-03 → 20% of all queries by 2025-12 → **targeting about 40% by the end of 2026**. Over 30 million users.

Citation presupposes that the page was crawled and indexed in the first place. In other words, GEO in Korea is largely **Naver indexing hygiene** — decided by sitemaps, RSS and allowing Yeti.

## robots.txt

Naver's crawler is `Yeti`. A `Yeti`-specific group takes precedence over `*`.
