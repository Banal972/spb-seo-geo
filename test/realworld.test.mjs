// Regressions found by running the tool on a real monorepo (two Next.js sites, next-sitemap
// owning robots.txt, a Naver verification file committed but not yet deployed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectApps, detectFramework } from '../skill/scripts/lib/framework.mjs';
import { collectLocalFiles } from '../skill/scripts/lib/collect.mjs';
import { robotsConfigSnippet } from '../skill/scripts/lib/generate.mjs';
import { checkers } from '../skill/scripts/lib/checkers.mjs';

const proj = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'spbseo-rw-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(d, p, '..'), { recursive: true });
    writeFileSync(join(d, p), body);
  }
  return d;
};
const NEXT = '{"dependencies":{"next":"15.0.0","next-sitemap":"4.0.0"}}';

test('a monorepo yields one entry per site, and shared packages are not sites', () => {
  const d = proj({
    'package.json': '{"name":"root","workspaces":["apps/*","packages/*"]}',
    'apps/reviewer/package.json': NEXT,
    'apps/reviewer/app/page.tsx': 'x',
    'apps/advertiser/package.json': NEXT,
    'apps/advertiser/app/page.tsx': 'x',
    'packages/ui/package.json': '{"dependencies":{"next":"15.0.0"}}',
  });
  assert.deepEqual(detectApps(d).map((a) => a.rel).sort(), ['apps/advertiser', 'apps/reviewer']);
  const fw = detectFramework(d);
  assert.equal(fw.name, null, 'the root itself is not a site');
  assert.equal(fw.apps.length, 2, 'so intake has to ask which one');
});

test('a single-app workspace needs no question', () => {
  const d = proj({
    'package.json': '{"workspaces":["apps/*"]}',
    'apps/web/package.json': NEXT,
    'apps/web/app/page.tsx': 'x',
  });
  const fw = detectFramework(d);
  assert.equal(fw.name, 'Next.js');
  assert.equal(fw.fromWorkspace, 'apps/web');
});

test('robots.txt owned by a generator is fixed in its config, never as a file', () => {
  const d = proj({
    'package.json': NEXT,
    'next-sitemap.config.js': 'module.exports = { siteUrl: "https://a.kr", generateRobotsTxt: true }',
    'public/robots.txt': 'User-agent: *\nAllow: /\n',
  });
  const fw = detectFramework(d);
  assert.equal(fw.robotsGeneratedBy.tool, 'next-sitemap');
  const snip = robotsConfigSnippet('next-sitemap', { policy: 'cite-only' });
  assert.match(snip, /robotsTxtOptions/);
  assert.match(snip, /'Claude-SearchBot', allow: '\/'/);
  assert.match(snip, /'GPTBot', disallow: '\/'/, 'cite-only blocks training in the config too');
});

test('a committed verification file counts as verified, not as missing', () => {
  const d = proj({ 'package.json': NEXT, 'public/naverc84cabc.html': 'x' });
  const local = collectLocalFiles(d, detectFramework(d));
  assert.deepEqual(local.verify, ['public/naverc84cabc.html']);
  const res = checkers.metaPresent(
    { remote: true, home: { parsed: { meta: {}, property: {} } }, files: {}, local },
    { names: ['naver-site-verification'], unknownIfMissing: true, localMatch: '(^|/)naver[a-z0-9]*\\.html$' },
  );
  assert.equal(res.ok, true);
  assert.match(res.detail, /verified by file/);
});

test('"exists locally but not deployed" is distinguished from "missing"', () => {
  const local = { rss: 'public/rss.xml', indexNowKeys: ['public/abc123def4567890.txt'], robots: 'public/robots.txt', verify: [] };
  const rss = checkers.rssPresent({ remote: true, feeds: [], local });
  assert.match(rss.detail, /exists locally but is not live yet/);
  const key = checkers.indexNowKey({ remote: true, indexNowKey: null, local });
  assert.match(key.detail, /exists locally but is not live yet/);
  const robots = checkers.urlOk({ remote: true, robots: { res: { ok: false, status: 404 } }, files: {}, local },
    { path: '/robots.txt', notHtml: true });
  assert.match(robots.detail, /exists locally but is not live yet/);
});
