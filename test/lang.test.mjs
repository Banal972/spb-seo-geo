// Two false positives from real sites: a JS-rendered shell (no content to compare) and a
// bilingual site (home lang compared against another page's text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkers } from '../skill/scripts/lib/checkers.mjs';
import { parseHtml } from '../skill/scripts/lib/html.mjs';

const page = (url, html) => ({ url, parsed: Object.assign(parseHtml(html), { url }) });
const doc = (lang, body) => `<html lang="${lang}"><head><title>t</title></head><body>${body}</body></html>`;
const ko = '한국어 본문입니다. '.repeat(60);
const en = 'This is an English page with plenty of body text. '.repeat(20);
const facts = (home, samples = []) => ({ remote: true, home, samples });

test('a bilingual site is not a mismatch — each page is judged against its own lang', () => {
  const f = facts(page('https://a.kr/', doc('ko', ko)), [page('https://a.kr/en/x', doc('en', en))]);
  const res = checkers.langMatchesContent(f);
  assert.equal(res.ok, true, res.detail);
  assert.match(res.detail, /2 pages match their own lang/);
});

test('a JS-rendered shell is unchecked, not a mismatch — CORE-12 owns that', () => {
  const f = facts(page('https://a.kr/', doc('ko', '<div id="root">Loading…</div>')));
  const res = checkers.langMatchesContent(f);
  assert.equal(res.ok, null);
  assert.match(res.detail, /CORE-12/);
});

test('a genuine mismatch is still caught, and named per page', () => {
  const f = facts(page('https://a.kr/', doc('en', ko)));
  const res = checkers.langMatchesContent(f);
  assert.equal(res.ok, false);
  assert.match(res.detail, /Hangul but lang=en/);
});

test('a missing lang attribute is reported on its own', () => {
  const f = facts({ url: 'https://a.kr/', parsed: Object.assign(parseHtml('<html><body>x</body></html>'), { url: 'https://a.kr/' }) });
  assert.match(checkers.langMatchesContent(f).detail, /no lang attribute/);
});
