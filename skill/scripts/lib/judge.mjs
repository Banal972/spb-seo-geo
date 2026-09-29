// rules x facts -> findings. No path here lets a model influence the verdict (invariant 9).
import { checkers } from './checkers.mjs';
import { loadCatalog, partitionByMarket, daysSince, STALE_DAYS } from './rules.mjs';

const statusFor = (ok, severity) => {
  if (ok === null) return 'unknown';
  if (ok === true) return 'pass';
  return severity === 'critical' ? 'fail' : severity === 'warn' ? 'warn' : 'info';
};

export function judge(facts, { market, aiPolicy = 'open' } = {}) {
  const { rules, rejected, stale } = loadCatalog();
  const { active, skipped } = partitionByMarket(rules, market);
  facts.aiPolicy = aiPolicy;

  const findings = [];
  for (const rule of active) {
    let res;
    try {
      res = checkers[rule.check](facts, rule.args || {}, rule);
    } catch (e) {
      res = { ok: null, detail: `checker error: ${String(e?.message || e)}` };
    }
    findings.push({
      id: rule.id, engine: rule.engine, severity: rule.severity, grade: rule.grade,
      status: statusFor(res.ok, rule.severity),
      detail: res.detail || '',
      problem: rule.problem, action: rule.action, evidence: rule.evidence,
      fixable: !!rule.autofix, fix: rule.fix || null, optIn: !!rule.optIn,
      todo: res.todo || [],
      stale: daysSince(rule.checked) > STALE_DAYS,
    });
  }

  const counts = { pass: 0, warn: 0, info: 0, fail: 0, unknown: 0, skipped: skipped.length };
  for (const f of findings) counts[f.status]++;

  return {
    findings, counts,
    skippedRules: skipped.map((r) => ({ id: r.id, engine: r.engine, problem: r.problem })),
    meta: { total: rules.length, rejected, stale: stale.map((r) => r.id) },
  };
}

const RANK = { fail: 0, warn: 1, info: 2, unknown: 3, pass: 4 };
export const bySeverity = (a, b) => (RANK[a.status] - RANK[b.status]) || a.id.localeCompare(b.id);
