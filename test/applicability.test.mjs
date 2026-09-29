import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, partitionByRequirements, REQUIREMENTS } from '../skill/scripts/lib/rules.mjs';
import { judge } from '../skill/scripts/lib/judge.mjs';
import { parseHtml } from '../skill/scripts/lib/html.mjs';
import { parseRobots } from '../skill/scripts/lib/robots.mjs';

const { rules } = loadCatalog();
const page = (html) => ({ res: { ok: true, status: 200, headers: {}, redirects: [], bytes: 100, contentType: 'text/html' }, url: 'https://a.kr/', parsed: Object.assign(parseHtml(html), { url: 'https://a.kr/' }) });
const facts = (html, extra = {}) => ({
  remote: true, baseUrl: 'https://a.kr/', origin: 'https://a.kr', samples: [], feeds: [], links: [], sitemaps: [],
  sitemapEntries: [], files: {}, indexNowKey: null, llms: { ok: false },
  robots: { res: { ok: true }, parsed: parseRobots('User-agent: *\nAllow: /\n') },
  home: page(html), engines: { engines: [], answered: false, suggested: {} }, ...extra,
});

const LANDING = '<html lang="ko"><head><title>T</title></head><body><h1>제품</h1><p>랜딩 페이지 본문입니다.</p></body></html>';
const ARTICLE = '<html lang="ko"><head><title>T</title></head><body><article><h1>글</h1><p>본문</p></article></body></html>';

test('a landing page is not judged on publication dates or prose structure', () => {
  const { notApplicable, active } = partitionByRequirements(rules, facts(LANDING));
  const ids = notApplicable.map((n) => n.id);
  assert.ok(ids.includes('GEO-12'), 'dates do not apply to a landing page');
  assert.ok(ids.includes('GEO-07'), 'neither do lists and tables');
  assert.ok(!active.some((r) => r.id === 'GEO-12'));
});

test('an article page is judged on them', () => {
  const { notApplicable } = partitionByRequirements(rules, facts(ARTICLE));
  const ids = notApplicable.map((n) => n.id);
  assert.ok(!ids.includes('GEO-12'));
  assert.ok(!ids.includes('GEO-07'));
});

test('crawler measurement is not attempted without a log, and is not reported as unchecked', () => {
  const { notApplicable } = partitionByRequirements(rules, facts(LANDING));
  for (const id of ['GEO-08', 'GEO-09', 'GEO-10']) {
    assert.ok(notApplicable.some((n) => n.id === id), `${id} needs a log`);
  }
  const r = judge(facts(LANDING));
  assert.equal(r.findings.some((f) => f.id === 'GEO-08'), false, 'never appears as a ? item');
  assert.equal(r.counts.notApplicable >= 5, true);
});

test('with a log, the measurement rules come back', () => {
  const withLog = facts(LANDING, { accessLog: { ok: true, families: { cite: [], train: [], user: [], search: [] }, window: 30, hasDates: true, path: 'x.log' } });
  const { active } = partitionByRequirements(rules, withLog);
  assert.ok(active.some((r) => r.id === 'GEO-08'));
});

test('an image-heavy page is no longer penalised for having images', () => {
  assert.equal(rules.some((r) => r.id === 'GEO-04'), false,
    'GEO-04 counted images against text, which punished a legitimate design; CORE-12 covers the real failure');
  assert.ok(rules.some((r) => r.id === 'CORE-12'), 'the real check — is there body text at all — stays');
});

test('what the user says is done is not repeated', () => {
  const r = judge(facts(LANDING), { completed: ['GOOGLE-07', 'BING-03'] });
  assert.equal(r.findings.some((f) => f.id === 'GOOGLE-07'), false);
  assert.deepEqual(r.completed.sort(), ['BING-03', 'GOOGLE-07']);
});

test('console-registration advice is conditional, not an order', () => {
  for (const id of ['GOOGLE-07', 'BING-03', 'NAVER-04']) {
    const r = rules.find((x) => x.id === id);
    assert.match(r.action, /If (you have )?not/i, `${id} must not assume it was never done`);
    assert.match(r.action, /--done/, `${id} must offer a way to silence it`);
  }
});

test('every requirement key is implemented', () => {
  for (const r of rules) if (r.requires) assert.ok(REQUIREMENTS[r.requires], `${r.id}: ${r.requires}`);
});
