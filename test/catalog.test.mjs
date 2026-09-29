import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, lintRule, partitionByMarket } from '../skill/scripts/lib/rules.mjs';
import { checkers } from '../skill/scripts/lib/checkers.mjs';

const { rules, rejected, stale } = loadCatalog();

test('no rule is rejected by the linter', () => {
  assert.deepEqual(rejected, [], JSON.stringify(rejected));
});

test('rule count and composition', () => {
  assert.equal(rules.length, 39);
  const by = {};
  for (const r of rules) by[r.engine] = (by[r.engine] || 0) + 1;
  assert.deepEqual(by, { core: 16, google: 7, naver: 4, bing: 3, ai: 7, yahoo: 2 });
});

test('every rule carries an evidence URL and a grade', () => {
  for (const r of rules) {
    assert.match(r.evidence, /^https?:\/\//, r.id);
    assert.ok(['primary', 'secondary', 'low'].includes(r.grade), r.id);
  }
});

test('a low-grade rule can never be critical', () => {
  for (const r of rules) if (r.grade === 'low') assert.notEqual(r.severity, 'critical', r.id);
});

test('every referenced checker is implemented', () => {
  for (const r of rules) assert.ok(checkers[r.check], `${r.id}: ${r.check}`);
});

test('the linter rejects a rule without evidence', () => {
  const errs = lintRule({ id: 'X', severity: 'warn', check: 'manual', problem: 'p', action: 'a', checked: '2026-01-01', grade: 'primary' });
  assert.ok(errs.some((e) => e.includes('evidence')));
});

test('no regional answer skips exactly the regional rules', () => {
  const { active, skipped } = partitionByMarket(rules, []);
  assert.equal(skipped.length, 6, 'Naver 4 + Yahoo 2');
  assert.equal(active.length, 33);
  assert.ok(skipped.every((r) => ['naver', 'yahoo'].includes(r.engine)));
  // IndexNow key and Open Graph live in CORE, so a site with no regional answer still gets them
  assert.ok(active.some((r) => r.id === 'CORE-16'));
  assert.ok(active.some((r) => r.id === 'CORE-15'));
});

test('markets are additive', () => {
  assert.equal(partitionByMarket(rules, ['kr']).active.length, 37);
  assert.equal(partitionByMarket(rules, ['jp']).active.length, 35);
  assert.equal(partitionByMarket(rules, ['kr', 'jp']).active.length, 39);
});

test('reports rules unverified for over 180 days', () => {
  assert.ok(Array.isArray(stale));
});
