import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gen from '../skill/scripts/lib/generate.mjs';
import { parseRobots, isAllowed } from '../skill/scripts/lib/robots.mjs';

test('preserves the existing robots.txt and appends only our block', () => {
  const existing = 'User-agent: *\nDisallow: /admin/\n\nSitemap: https://x.kr/s.xml\n';
  const merged = gen.mergeRobots(existing, gen.robotsBlock({ policy: 'open' }));
  assert.ok(merged.includes('Disallow: /admin/'), 'existing rules preserved');
  assert.ok(merged.includes(gen.MARK_START) && merged.includes(gen.MARK_END));
});

test('applying twice yields the same result (idempotent)', () => {
  const b = gen.robotsBlock({ policy: 'open' });
  const once = gen.mergeRobots('User-agent: *\nAllow: /\n', b);
  assert.equal(gen.mergeRobots(once, b), once);
});

test('cite-only blocks training bots while allowing citation bots', () => {
  const r = parseRobots(gen.mergeRobots('', gen.robotsBlock({ policy: 'cite-only' })));
  assert.equal(isAllowed(r, 'GPTBot', '/').allowed, false);
  assert.equal(isAllowed(r, 'ClaudeBot', '/').allowed, false);
  assert.equal(isAllowed(r, 'OAI-SearchBot', '/').allowed, true);
  assert.equal(isAllowed(r, 'Claude-SearchBot', '/').allowed, true);
  assert.equal(isAllowed(r, 'PerplexityBot', '/').allowed, true);
});

test('open allows training bots too', () => {
  const r = parseRobots(gen.mergeRobots('', gen.robotsBlock({ policy: 'open' })));
  assert.equal(isAllowed(r, 'GPTBot', '/').allowed, true);
});

test('sitemap emits absolute URLs and lastmod', () => {
  const xml = gen.sitemapXml('https://a.kr', ['/', '/about'], '2026-09-29');
  assert.ok(xml.includes('<loc>https://a.kr/</loc>'));
  assert.ok(xml.includes('<lastmod>2026-09-29</lastmod>'));
});

test('the IndexNow key is 32 hex chars and the file contains the key itself', () => {
  const k = gen.indexNowKey();
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.equal(gen.indexNowKeyFile(k).trim(), k);
});

test('RSS output is structurally valid and escaped', () => {
  const xml = gen.rssXml({ origin: 'https://a.kr', title: 'T', items: [{ url: 'https://a.kr/p', title: '글 & 제목' }] });
  assert.ok(xml.includes('<rss version="2.0">'));
  assert.ok(xml.includes('글 &amp; 제목'), 'XML escaping');
});
