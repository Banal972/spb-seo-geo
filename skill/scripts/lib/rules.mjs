// Catalog loading and linting. A rule without evidence/grade is never loaded (invariant 4).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkers } from './checkers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CATALOG_PATH = join(HERE, '..', '..', 'rules', 'catalog.json');
const GRADES = new Set(['primary', 'secondary', 'low']);
const SEVERITIES = new Set(['critical', 'warn', 'info']);
export const STALE_DAYS = 180;

export function lintRule(r) {
  const errs = [];
  if (!r.id) errs.push('missing id');
  if (!SEVERITIES.has(r.severity)) errs.push(`unknown severity: ${r.severity}`);
  if (!r.evidence) errs.push('missing evidence URL');
  if (!GRADES.has(r.grade)) errs.push(`unknown grade: ${r.grade}`);
  if (r.grade === 'low' && r.severity === 'critical') errs.push('grade=low cannot be critical');
  if (!checkers[r.check]) errs.push(`no such checker: ${r.check}`);
  if (!r.problem || !r.action) errs.push('missing problem/action');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked || '')) errs.push('missing checked date');
  if (r.autofix && !r.fix) errs.push('autofix=true but no fix generator specified');
  return errs;
}

export function loadCatalog(path = CATALOG_PATH) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const valid = [];
  const rejected = [];
  for (const r of raw.rules) {
    const errs = lintRule(r);
    if (errs.length) rejected.push({ id: r.id || '?', errs });
    else valid.push(r);
  }
  const stale = valid.filter((r) => daysSince(r.checked) > STALE_DAYS);
  return { version: raw.version, rules: valid, rejected, stale };
}

export const daysSince = (d) => Math.floor((Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 86400000);

// Rules that do not match the detected markets are not evaluated, but they are never
// hidden (invariant 7). `markets` is an array: a site can target several regions at once.
export function partitionByMarket(rules, markets = []) {
  const set = new Set(Array.isArray(markets) ? markets : [markets].filter(Boolean));
  const active = [], skipped = [];
  for (const r of rules) {
    if (r.market && r.market !== 'all' && !set.has(r.market)) skipped.push(r);
    else active.push(r);
  }
  return { active, skipped };
}

if (process.argv[1] && process.argv[1].endsWith('rules.mjs') && process.argv.includes('--lint')) {
  const { rules, rejected, stale } = loadCatalog();
  console.log(`${rules.length} rules loaded`);
  if (stale.length) console.log(`needs re-verification (${stale.length}): ${stale.map((r) => r.id).join(', ')}`);
  if (rejected.length) {
    console.error('rejected rules:');
    for (const r of rejected) console.error(` - ${r.id}: ${r.errs.join(' / ')}`);
    process.exit(1);
  }
  console.log('lint passed');
}
