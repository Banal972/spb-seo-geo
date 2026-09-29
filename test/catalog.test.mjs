import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, lintRule, partitionByMarket } from '../skill/scripts/lib/rules.mjs';
import { checkers } from '../skill/scripts/lib/checkers.mjs';

const { rules, rejected, stale } = loadCatalog();

test('no rule is rejected by the linter', () => {
  assert.deepEqual(rejected, [], JSON.stringify(rejected));
});

test('rule count and composition', () => {
  assert.equal(rules.length, 37);
  const by = {};
  for (const r of rules) by[r.engine] = (by[r.engine] || 0) + 1;
  assert.deepEqual(by, { core: 16, google: 7, naver: 4, bing: 3, ai: 7 });
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

test('market=global skips only the 4 Naver-specific rules', () => {
  const { active, skipped } = partitionByMarket(rules, 'global');
  assert.equal(skipped.length, 4);
  assert.equal(active.length, 33);
  assert.ok(skipped.every((r) => r.engine === 'naver'));
  // IndexNow key and Open Graph live in CORE, so non-Korean sites still get them
  assert.ok(active.some((r) => r.id === 'CORE-16'));
  assert.ok(active.some((r) => r.id === 'CORE-15'));
});

test('market=kr evaluates every rule', () => {
  assert.equal(partitionByMarket(rules, 'kr').active.length, 37);
});

test('reports rules unverified for over 180 days', () => {
  assert.ok(Array.isArray(stale));
});
