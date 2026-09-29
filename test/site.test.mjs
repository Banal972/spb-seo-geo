import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectSiteUrl, detectAccessLog } from '../skill/scripts/lib/site.mjs';
import { loadCatalog, partitionByScope } from '../skill/scripts/lib/rules.mjs';

const proj = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'spbseo-site-'));
  for (const [p, body] of Object.entries(files)) {
    const full = join(d, p);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return d;
};

test('finds the URL in a framework config', () => {
  const d = proj({ 'astro.config.mjs': "export default { site: 'https://aaa.com' }" });
  const r = detectSiteUrl(d);
  assert.equal(r.url, 'https://aaa.com');
  assert.match(r.where, /astro\.config/);
});

test('finds it in package.json homepage and in a CNAME file', () => {
  assert.equal(detectSiteUrl(proj({ 'package.json': '{"homepage":"https://aaa.com/"}' })).url, 'https://aaa.com');
  assert.equal(detectSiteUrl(proj({ 'public/CNAME': 'aaa.com\n' })).url, 'https://aaa.com');
});

test('finds it in an env file, and in an already-written sitemap', () => {
  assert.equal(detectSiteUrl(proj({ '.env.production': 'NEXT_PUBLIC_SITE_URL=https://aaa.com\nOTHER=1\n' })).url, 'https://aaa.com');
  assert.equal(detectSiteUrl(proj({ 'public/sitemap.xml': '<url><loc>https://aaa.com/a</loc></url>' })).url, 'https://aaa.com');
});

test('ignores placeholders, localhost and unexpanded variables', () => {
  assert.equal(detectSiteUrl(proj({ 'package.json': '{"homepage":"http://localhost:3000"}' })).url, null);
  assert.equal(detectSiteUrl(proj({ '.env': 'SITE_URL=https://example.com\n' })).url, null);
  assert.equal(detectSiteUrl(proj({ '.env': 'SITE_URL=${VERCEL_URL}\n' })).url, null);
});

test('agreement between sources wins over source order', () => {
  const d = proj({
    'package.json': '{"homepage":"https://old.example.net"}',
    'public/CNAME': 'aaa.com\n',
    'public/robots.txt': 'Sitemap: https://aaa.com/sitemap.xml\n',
  });
  assert.equal(detectSiteUrl(d).url, 'https://aaa.com');
});

test('no signal means no URL — it is asked for, not invented', () => {
  assert.equal(detectSiteUrl(proj({ 'package.json': '{"name":"x"}' })).url, null);
});

test('finds an access log lying in the repo', () => {
  assert.match(detectAccessLog(proj({ 'logs/access.log': 'x' })), /logs\/access\.log$/);
  assert.equal(detectAccessLog(proj({ 'package.json': '{}' })), null);
});

test('--only splits the catalog and says nothing is lost silently', () => {
  const { rules } = loadCatalog();
  const seo = partitionByScope(rules, 'seo');
  const geo = partitionByScope(rules, 'geo');
  assert.equal(seo.active.length, 30);
  assert.equal(geo.active.length, 24);
  assert.equal(seo.active.length + seo.skipped.length, rules.length);
  // Infrastructure that gates both must appear in both
  for (const id of ['CORE-01', 'CORE-03', 'GOOGLE-03', 'CORE-12']) {
    assert.ok(seo.active.some((r) => r.id === id), `${id} in seo`);
    assert.ok(geo.active.some((r) => r.id === id), `${id} in geo`);
  }
  assert.equal(partitionByScope(rules, null).active.length, rules.length);
});
