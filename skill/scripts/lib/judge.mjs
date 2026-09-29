// rules x facts -> findings. No path here lets a model influence the verdict (invariant 9).
import { checkers } from './checkers.mjs';
import { loadCatalog, partitionByEngines, partitionByScope, partitionByRequirements, daysSince, STALE_DAYS } from './rules.mjs';

const statusFor = (ok, severity) => {
  if (ok === null) return 'unknown';
  if (ok === true) return 'pass';
  return severity === 'critical' ? 'fail' : severity === 'warn' ? 'warn' : 'info';
};

export function judge(facts, { engines = null, aiPolicy = 'open', only = null, completed = [] } = {}) {
  const { rules, rejected, stale } = loadCatalog();
  const scoped = partitionByScope(rules, only);
  const engineFiltered = partitionByEngines(scoped.active, engines);
  const req = partitionByRequirements(engineFiltered.active, facts);
  // Things the user already told us are done stop being repeated.
  const done = new Set(completed);
  const active = req.active.filter((r) => !done.has(r.id));
  const skipped = engineFiltered.skipped;
  const outOfScope = scoped.skipped;
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
      id: rule.id, engine: rule.engine, region: rule.region || null, severity: rule.severity, grade: rule.grade,
      status: statusFor(res.ok, rule.severity),
      detail: res.detail || '',
      problem: rule.problem, action: rule.action, evidence: rule.evidence,
      fixable: !!rule.autofix, fix: rule.fix || null, optIn: !!rule.optIn,
      todo: res.todo || [],
      stale: daysSince(rule.checked) > STALE_DAYS,
    });
  }

  const counts = { pass: 0, warn: 0, info: 0, fail: 0, unknown: 0, skipped: skipped.length, outOfScope: outOfScope.length, notApplicable: req.notApplicable.length };
  for (const f of findings) counts[f.status]++;

  return {
    findings, counts,
    skippedRules: skipped.map((r) => ({ id: r.id, engine: r.engine, region: r.region, problem: r.problem })),
    outOfScope: outOfScope.map((r) => r.id),
    notApplicable: req.notApplicable,
    completed: req.active.filter((r) => done.has(r.id)).map((r) => r.id),
    only,
    meta: { total: rules.length, rejected, stale: stale.map((r) => r.id) },
  };
}

const RANK = { fail: 0, warn: 1, info: 2, unknown: 3, pass: 4 };
export const bySeverity = (a, b) => (RANK[a.status] - RANK[b.status]) || a.id.localeCompare(b.id);
