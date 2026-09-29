# Yahoo — two different engines with the same name

Yahoo has no search index of its own. Which engine backs it depends on the country, and that decides what you have to do.

| Surface | Powered by | So what covers it |
| --- | --- | --- |
| **Yahoo! JAPAN** (yahoo.co.jp) | **Google's index** | the `GOOGLE-*` rules |
| Yahoo everywhere else (yahoo.com) | **Bing** (contractually the majority of results) | the `BING-*` rules |

## Yahoo! JAPAN

- Roughly a third of Japan's search market, second to Google itself — and both run on the same index, so Japan's search logic is effectively one algorithm with two front ends.
- The partnership with Google was up for renewal in 2025 and has continued into 2026. Re-verify this before relying on it: if it ever ends, Japan needs its own rule group.
- **There is no separate webmaster console.** Submit sitemaps through Google Search Console. Yahoo! JAPAN's old Site Explorer is long gone.
- The results page layout differs and Yahoo! JAPAN injects its own modules, so visibility is not identical — but the index, and therefore crawling and eligibility, is Google's.
- Yahoo! JAPAN does run **its own crawlers** (`Y!J-WSC`, `Y!J-DLC`, `Y!J-ASR`, `Y!J-BRW` and others in the `Y!J-` family). They feed Yahoo! JAPAN's own surfaces rather than web search ranking, and the recent ones honour robots.txt. Blocking them is `YAHOO-01`.

## Yahoo global

Microsoft powers the majority of Yahoo's results under a non-exclusive deal, with Bing contractually required for most of them. Practically: fix Bing, and Yahoo follows. That is why there is no separate rule group — `CORE-16` (IndexNow) and `BING-02` (bingbot) already do the work.

## What this means for advice

Do not tell a user to "optimise for Yahoo" as if it were a third engine. The accurate advice is:

- targeting Japan → fix the Google items, and make sure `Y!J-*` is not blocked
- targeting anywhere else → fix the Bing items

`YAHOO-02` carries exactly this as an informational note so it appears in the report rather than only in this file.
