import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, lintRule, partitionByMarket } from '../skill/scripts/lib/rules.mjs';
import { checkers } from '../skill/scripts/lib/checkers.mjs';

const { rules, rejected, stale } = loadCatalog();

test('no rule is rejected by the linter', () => {
  assert.deepEqual(rejected, [], JSON.stringify(rejected));
});

test('rule count and composition', () => {
  assert.equal(rules.length, 38);
  const by = {};
  for (const r of rules) by[r.engine] = (by[r.engine] || 0) + 1;
  assert.deepEqual(by, { core: 16, google: 7, naver: 4, bing: 3, ai: 7, yahoo: 1 });
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

test('by default every rule is evaluated — no market gate', () => {
  const { active, skipped } = partitionByMarket(rules, null);
  assert.equal(skipped.length, 0, 'nothing is hidden unless asked');
  assert.equal(active.length, rules.length);
});

test('allowing a regional crawler is checked for everyone', () => {
  const { active } = partitionByMarket(rules, ['jp']);
  // Yeti is Korea's crawler but unblocking it is free, so it must not be gated away
  assert.ok(active.some((r) => r.id === 'NAVER-02'), 'Yeti check is universal');
  assert.ok(active.some((r) => r.id === 'YAHOO-01'), 'Y!J check is universal');
});

test('a market filter only hides optional console advice', () => {
  const { active, skipped } = partitionByMarket(rules, ['jp']);
  assert.ok(skipped.every((r) => r.region === 'kr'));
  assert.deepEqual(skipped.map((r) => r.id).sort(), ['NAVER-01', 'NAVER-03', 'NAVER-04']);
  assert.ok(active.some((r) => r.id === 'CORE-16'));
  assert.ok(active.some((r) => r.id === 'CORE-15'));
});

test('registration-dependent regional rules can never read as failures', () => {
  for (const r of rules.filter((x) => x.region)) {
    assert.equal(r.severity, 'info', `${r.id} must be info, not ${r.severity}`);
  }
});

test('reports rules unverified for over 180 days', () => {
  assert.ok(Array.isArray(stale));
});
