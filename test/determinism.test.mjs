// The core promise is that the same input yields the same verdict. A rule that flaps is
// worse than no rule: the user stops trusting every other line too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkers } from '../skill/scripts/lib/checkers.mjs';

const base = (linked, entries, samples = 2) => ({
  remote: true,
  home: { url: 'https://a.kr/', parsed: { anchors: [] } },
  samples: Array.from({ length: samples }, () => ({ parsed: {} })),
  sitemapEntries: entries.map((loc) => ({ loc })),
  linkedUrls: new Set(linked),
});

test('the orphan check ignores HTTP results — only the link graph we parsed', () => {
  const f = base(['https://a.kr/p1'], ['https://a.kr/p1', 'https://a.kr/p2', 'https://a.kr/p3', 'https://a.kr/p4']);
  // Partially linked is not a finding: we only read a few pages, so it proves nothing.
  assert.equal(checkers.orphanPages(f).ok, true);
  assert.match(checkers.orphanPages(f).detail, /1\/4 sitemap URLs linked/);
});

test('only the absolute case is reported', () => {
  const none = base([], ['https://a.kr/p1', 'https://a.kr/p2', 'https://a.kr/p3', 'https://a.kr/p4']);
  assert.equal(checkers.orphanPages(none).ok, null, 'no links parsed at all is unknown, not a failure');
  const someLinksElsewhere = base(['https://a.kr/other'], ['https://a.kr/p1', 'https://a.kr/p2', 'https://a.kr/p3', 'https://a.kr/p4']);
  assert.equal(checkers.orphanPages(someLinksElsewhere).ok, false);
  assert.match(checkers.orphanPages(someLinksElsewhere).detail, /none of 4 sitemap URLs/);
});

test('repeated evaluation of identical facts gives an identical verdict', () => {
  const f = base(['https://a.kr/p1', 'https://a.kr/p2'], ['https://a.kr/p1', 'https://a.kr/p2', 'https://a.kr/p3', 'https://a.kr/p4']);
  const runs = Array.from({ length: 5 }, () => JSON.stringify(checkers.orphanPages(f)));
  assert.equal(new Set(runs).size, 1);
});

test('the IndexNow key is taken from the file in the repo, not from config alone', () => {
  const f = {
    remote: true,
    indexNowKey: { key: 'bad802f0f0b8182c1f5620dd8b4f666e', fromRepo: true, res: { ok: true, body: 'bad802f0f0b8182c1f5620dd8b4f666e' } },
  };
  const res = checkers.indexNowKey(f);
  assert.equal(res.ok, true);
  assert.match(res.detail, /key taken from the file in your repo/);
});

test('a key committed but not deployed says deploy, not create', () => {
  const f = { remote: true, indexNowKey: { key: 'abc', fromRepo: true, res: { ok: false, status: 404 } } };
  assert.match(checkers.indexNowKey(f).detail, /in the repo but not live yet, so deploy it/);
});
