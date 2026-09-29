# Bing — the cheapest engine to finish

## Ownership verification

- `<meta name="msvalidate.01" content="...">`
- `BingSiteAuth.xml` at the root
- DNS TXT/CNAME
- **import the site from Google Search Console** ← fastest, about a minute

A missing meta tag does not prove the site is unverified, so the verdict is `?` (`BING-01`).

## robots.txt

The crawler is `bingbot`. Blocking it makes `BING-02` critical.
Bing's index also backs other AI search products, so the impact does not stop at Bing.

## IndexNow

Bing is the engine driving IndexNow. As of 2024 it had received about 2.5 billion submitted URLs, and roughly **17% of clicked URLs on Bing** arrived through IndexNow.

One key file (`CORE-16`) covers Bing, Naver, Yandex and Seznam at once.

## API (unused in this version)

- one API key per account, issued from Bing Webmaster Tools
- `SubmitUrlBatch` accepts up to 500 URLs per call
- site addition and verification are also available via API

IndexNow already achieves the goal, so the MVP does not use the API.
