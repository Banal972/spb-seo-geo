import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, isAllowed, blocksEverything, groupFor } from '../skill/scripts/lib/robots.mjs';

const txt = `
User-agent: *
Disallow: /admin/

User-agent: Yeti
Disallow: /

User-agent: ClaudeBot
Disallow: /
User-agent: Claude-SearchBot
Allow: /

Sitemap: https://example.kr/sitemap.xml
`;

test('reads the Sitemap declaration', () => {
  assert.deepEqual(parseRobots(txt).sitemaps, ['https://example.kr/sitemap.xml']);
});

test('a UA-specific group takes precedence over *', () => {
  const r = parseRobots(txt);
  assert.equal(isAllowed(r, 'Yeti', '/').allowed, false, 'Yeti is blocked');
  assert.equal(isAllowed(r, 'Googlebot', '/').allowed, true, 'falls back to the * group');
  assert.equal(isAllowed(r, 'Googlebot', '/admin/x').allowed, false);
});

test('distinguishes training bots from citation bots (the core of this project)', () => {
  const r = parseRobots(txt);
  assert.equal(isAllowed(r, 'ClaudeBot', '/').allowed, false, 'training bot blocked');
  assert.equal(isAllowed(r, 'Claude-SearchBot', '/').allowed, true, 'the citation bot must stay allowed');
});

test('consecutive User-agent lines form one group', () => {
  const r = parseRobots('User-agent: A\nUser-agent: B\nDisallow: /x');
  assert.equal(r.groups.length, 1);
  assert.equal(isAllowed(r, 'B', '/x').allowed, false);
});

test('an empty Disallow allows everything', () => {
  const r = parseRobots('User-agent: *\nDisallow:');
  assert.equal(isAllowed(r, 'X', '/any').allowed, true);
});

test('longest match wins; allow wins ties', () => {
  const r = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b');
  assert.equal(isAllowed(r, 'X', '/a/c').allowed, false);
  assert.equal(isAllowed(r, 'X', '/a/b/c').allowed, true);
  const tie = parseRobots('User-agent: *\nDisallow: /p\nAllow: /p');
  assert.equal(isAllowed(tie, 'X', '/p').allowed, true);
});

test('wildcards and the $ anchor', () => {
  const r = parseRobots('User-agent: *\nDisallow: /*.pdf$');
  assert.equal(isAllowed(r, 'X', '/a/b.pdf').allowed, false);
  assert.equal(isAllowed(r, 'X', '/a/b.pdf?x=1').allowed, true);
});

test('detects a site-wide block', () => {
  assert.equal(blocksEverything(parseRobots('User-agent: *\nDisallow: /')), true);
  assert.equal(blocksEverything(parseRobots(txt)), false);
});

test('UA matching is case-insensitive and allows prefix matches', () => {
  const r = parseRobots('User-agent: yeti\nDisallow: /');
  assert.equal(groupFor(r, 'Yeti/1.1')?.rules.length, 1);
});
