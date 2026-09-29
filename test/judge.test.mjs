import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge } from '../skill/scripts/lib/judge.mjs';
import { renderScan, renderJson } from '../skill/scripts/lib/render.mjs';
import { parseRobots } from '../skill/scripts/lib/robots.mjs';
import { parseHtml } from '../skill/scripts/lib/html.mjs';

// Hand-built fixture of remote facts, so verdict logic is tested without the network
function fixture({ robots = 'User-agent: *\nAllow: /\n', html = '<html lang="ko"><head><title>T</title><meta name="description" content="d"><link rel="canonical" href="https://a.kr/"></head><body>본문</body></html>' } = {}) {
  const home = { res: { ok: true, status: 200, headers: {}, redirects: [], bytes: 100, contentType: 'text/html' }, url: 'https://a.kr/', parsed: Object.assign(parseHtml(html), { url: 'https://a.kr/' }) };
  return {
    remote: true, baseUrl: 'https://a.kr/', origin: 'https://a.kr', samples: [], feeds: [], links: [], sitemaps: [],
    sitemapEntries: [], files: {}, indexNowKey: null,
    robots: { res: { ok: true, status: 200, contentType: 'text/plain', body: robots, bytes: robots.length }, parsed: parseRobots(robots) },
    home, llms: { ok: false, status: 404 },
    market: { markets: ['kr'], answered: true, source: '--market', suggested: { kr: ['a.kr domain'] } },
  };
}

test('blocking a citation bot is a critical failure', () => {
  const f = fixture({ robots: 'User-agent: Claude-SearchBot\nDisallow: /\n' });
  const r = judge(f, { markets: ['kr'] });
  const geo = r.findings.find((x) => x.id === 'GEO-01');
  assert.equal(geo.status, 'fail');
  assert.ok(geo.detail.includes('Claude-SearchBot'));
});

test('nosnippet is a critical failure (it is the precondition for AI citation)', () => {
  const f = fixture({ html: '<html lang="ko"><head><meta name="robots" content="nosnippet"><title>T</title></head><body>본문</body></html>' });
  const r = judge(f, { markets: ['kr'] });
  assert.equal(r.findings.find((x) => x.id === 'GOOGLE-03').status, 'fail');
});

test('unknown is never promoted to pass', () => {
  const f = fixture();
  const r = judge(f, { markets: ['kr'] });
  const naver = r.findings.find((x) => x.id === 'NAVER-04');
  assert.equal(naver.status, 'unknown');
  assert.ok(naver.todo.length >= 3, 'console work is handed to todo');
});

test('with no regional answer, regional rules are counted as skipped and still surfaced', () => {
  const f = fixture();
  f.market = { markets: [], answered: false, suggested: {} };
  const r = judge(f, { markets: [] });
  assert.equal(r.counts.skipped, 6);
  assert.equal(r.skippedRules.length, 6);
  const text = renderScan(r, f, {});
  assert.match(text, /4 Naver \(Korea\) rules not evaluated/);
  assert.match(text, /2 Yahoo! JAPAN \(Japan\) rules not evaluated/);
  assert.match(text, /--market=kr/);
});

test('the report never enumerates passing rules', () => {
  const f = fixture();
  const r = judge(f, { markets: ['kr'] });
  const text = renderScan(r, f, {});
  assert.match(text, /✅ \d+ pass/);
  const passIds = r.findings.filter((x) => x.status === 'pass').map((x) => x.id);
  assert.ok(passIds.length > 3);
  assert.equal(passIds.filter((id) => text.includes(id)).length, 0, 'passing rule IDs must not appear in the body');
});

test('no score is ever produced', () => {
  const f = fixture();
  const text = renderScan(judge(f, { markets: ['kr'] }), f, {});
  assert.doesNotMatch(text, /\/\s?100|score/i);
});

test('--json emits a stable schema', () => {
  const f = fixture();
  const j = JSON.parse(renderJson(judge(f, { markets: ['kr'] }), f));
  assert.equal(j.tool, 'spb-seo-geo');
  assert.ok(j.counts && j.findings.length);
  assert.deepEqual(j.market.markets, ['kr']);
  assert.ok(j.findings.every((x) => x.evidence.startsWith('http')));
});

test('under ai-policy=cite-only, allowed training bots are flagged as policy mismatch', () => {
  const f = fixture();
  const r = judge(f, { markets: ['kr'], aiPolicy: 'cite-only' });
  assert.equal(r.findings.find((x) => x.id === 'GEO-02').status, 'info');
});
