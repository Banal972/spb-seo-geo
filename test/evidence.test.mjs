// Citations are the product's only defence against being another folklore SEO tool.
// These pin the corrections found by reading each cited page against its claim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../skill/scripts/lib/rules.mjs';

const { rules } = loadCatalog();
const byId = Object.fromEntries(rules.map((r) => [r.id, r]));

test('every rule cites a URL and states its grade', () => {
  for (const r of rules) {
    assert.match(r.evidence, /^https:\/\//, r.id);
    assert.ok(['primary', 'secondary', 'low'].includes(r.grade), r.id);
  }
});

test('a low-grade rule can never be critical', () => {
  for (const r of rules) if (r.grade === 'low') assert.notEqual(r.severity, 'critical', r.id);
});

test('sitemap limits cite the page that actually states the numbers', () => {
  const r = byId['CORE-04'];
  assert.match(r.evidence, /build-sitemap$/, 'the large-sitemaps page never prints 50,000 or 50MB');
  assert.match(r.problem, /50,000 URLs or 50MB/);
});

test('the redirect rule does not invent a limit its source never gave', () => {
  const r = byId['CORE-08'];
  assert.equal(r.args.max, 3, 'one hop was our invention; Google follows up to 10');
  assert.equal(r.severity, 'info');
  assert.match(r.action, /up to 10 hops/);
});

test('title and description are separate rules with separate sources', () => {
  assert.equal(byId['CORE-10'].check, 'titlePresent');
  assert.match(byId['CORE-10'].evidence, /title-link/);
  assert.equal(byId['CORE-18'].check, 'descriptionPresent');
  assert.match(byId['CORE-18'].evidence, /snippet/, 'the title page never mentions meta description');
  assert.equal(byId['CORE-18'].severity, 'info', 'a description is not a ranking factor');
});

test('canonical advice does not claim to be mandatory', () => {
  assert.match(byId['CORE-09'].action, /not required/);
  assert.match(byId['CORE-09'].action, /best practices/);
});

test('rules that cannot be checked from outside offer a way to silence them', () => {
  for (const id of ['GOOGLE-07', 'BING-03', 'NAVER-04']) {
    assert.match(byId[id].action, /--done/, id);
  }
});
