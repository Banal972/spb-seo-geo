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
    engines: { engines: ['naver'], answered: true, source: '--engines', suggested: { naver: ['a.kr domain'] } },
  };
}

test('blocking a citation bot is a critical failure', () => {
  const f = fixture({ robots: 'User-agent: Claude-SearchBot\nDisallow: /\n' });
  const r = judge(f, { engines: null });
  const geo = r.findings.find((x) => x.id === 'GEO-01');
  assert.equal(geo.status, 'fail');
  assert.ok(geo.detail.includes('Claude-SearchBot'));
});

test('nosnippet is a critical failure (it is the precondition for AI citation)', () => {
  const f = fixture({ html: '<html lang="ko"><head><meta name="robots" content="nosnippet"><title>T</title></head><body>본문</body></html>' });
  const r = judge(f, { engines: null });
  assert.equal(r.findings.find((x) => x.id === 'GOOGLE-03').status, 'fail');
});

test('unknown is never promoted to pass', () => {
  const f = fixture();
  const r = judge(f, { engines: null });
  const naver = r.findings.find((x) => x.id === 'NAVER-04');
  assert.equal(naver.status, 'unknown');
  assert.ok(naver.todo.length >= 3, 'console work is handed to todo');
});

test('choosing engines surfaces what it hid instead of silently dropping it', () => {
  const f = fixture();
  f.engines = { engines: ['yahoo'], answered: true, source: '--engines', suggested: {} };
  const r = judge(f, { engines: ['yahoo'] });
  assert.equal(r.counts.skipped, 3);
  assert.equal(r.skippedRules.length, 3);
  const text = renderScan(r, f, {});
  assert.match(text, /3 optional Naver \(Korea\) items hidden/);
  assert.match(text, /--engines/);
});

test('the report never enumerates passing rules', () => {
  const f = fixture();
  const r = judge(f, { engines: null });
  const text = renderScan(r, f, {});
  assert.match(text, /✅ \d+ pass/);
  const passIds = r.findings.filter((x) => x.status === 'pass').map((x) => x.id);
  assert.ok(passIds.length > 3);
  assert.equal(passIds.filter((id) => text.includes(id)).length, 0, 'passing rule IDs must not appear in the body');
});

test('no score is ever produced', () => {
  const f = fixture();
  const text = renderScan(judge(f, { engines: null }), f, {});
  assert.doesNotMatch(text, /\/\s?100|score/i);
});

test('--json emits a stable schema', () => {
  const f = fixture();
  const j = JSON.parse(renderJson(judge(f, { engines: null }), f));
  assert.equal(j.tool, 'spb-seo-geo');
  assert.ok(j.counts && j.findings.length);
  assert.deepEqual(j.engines.selected, ['naver'], 'echoes the selection as-is');
  assert.ok(j.findings.every((x) => x.evidence.startsWith('http')));
});

test('under ai-policy=cite-only, allowed training bots are flagged as policy mismatch', () => {
  const f = fixture();
  const r = judge(f, { engines: null, aiPolicy: 'cite-only' });
  assert.equal(r.findings.find((x) => x.id === 'GEO-02').status, 'info');
});

// A low-effort model relayed every count from an --only=seo run correctly and silently
// dropped the line saying GEO had not been checked. The reader saw "26 pass, no problems"
// for what was two thirds of an audit. The line has to read as a loss, not as a flag.
test('an --only run says what it did not check, in the reader\'s terms', () => {
  const f = fixture();
  const seo = judge(f, { only: 'seo' });
  assert.ok(seo.counts.outOfScope > 0, 'seo-only leaves geo rules unevaluated');
  const text = renderScan(seo, f, {});
  assert.match(text, /NOT CHECKED: AI citation \(GEO\)/);
  assert.match(text, /not the full picture/i);

  const geo = judge(f, { only: 'geo' });
  assert.match(renderScan(geo, f, {}), /NOT CHECKED: classic search \(SEO\)/);

  // A full run must not claim anything was skipped.
  assert.doesNotMatch(renderScan(judge(f, {}), f, {}), /NOT CHECKED/);
});
