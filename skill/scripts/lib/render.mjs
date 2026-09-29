// Rendering. stdout carries the report only. Passes as counts, failures as sentences.
import { enginesSentence, LABEL as ENGINE_LABEL } from './engines.mjs';
import { bySeverity } from './judge.mjs';
import { isTTY } from './args.mjs';

const GRADE_LABEL = { primary: 'primary', secondary: 'secondary', low: 'low' };
const CRITICAL_SHOWN = 3;   // Feeling overwhelmed is the top drop-off cause: expand at most 3 criticals

export function renderScan(result, facts, opts = {}) {
  const L = [];
  const c = result.counts;
  const head = [
    'spb-seo-geo',
    facts.baseUrl ? new URL(facts.baseUrl).host : '(local only)',
    facts.framework || 'framework unknown',
    `${result.findings.length + c.skipped} rules`,
  ];
  L.push(head.join('  ·  '), '');
  const es = enginesSentence(facts.engines);
  if (es.length) L.push(...es, '');
  L.push(`✅ ${c.pass} pass   ⚠️ ${c.warn} warn   ❌ ${c.fail} fail   ? ${c.unknown} unchecked   ⏭ ${c.skipped} skipped` + (c.info ? `   · ${c.info} note` : ''), '');

  const sorted = [...result.findings].sort(bySeverity);
  const fails = sorted.filter((f) => f.status === 'fail');
  const warns = sorted.filter((f) => f.status === 'warn');
  const infos = sorted.filter((f) => f.status === 'info');
  const unknowns = sorted.filter((f) => f.status === 'unknown');

  const shownFails = opts.verbose ? fails : fails.slice(0, CRITICAL_SHOWN);
  for (const f of shownFails) L.push(...block('❌', f), '');
  if (fails.length > shownFails.length) {
    L.push(`❌ ${fails.length - shownFails.length} more — start with the ${shownFails.length} above (--verbose for all)`, '');
  }

  if (warns.length) {
    if (opts.verbose) { for (const f of warns) L.push(...block('⚠️', f), ''); }
    else {
      const line = warns.map((f) => `${f.id} ${f.problem}`).join(' · ');
      L.push(`⚠️ ${warns.length} warnings: ${truncate(line, 240)}`, '   (--verbose for detail)', '');
    }
  }

  if (infos.length) {
    if (opts.verbose) { for (const f of infos) L.push(...block('·', f), ''); }
    else {
      const line = infos.map((f) => `${f.id} ${f.problem}`).join(' · ');
      L.push(`·  ${infos.length} notes: ${truncate(line, 200)}`, '');
    }
  }

  if (unknowns.length) {
    // "unknown" means "we could not check", not "something is wrong". Word it that way.
    for (const f of unknowns.slice(0, opts.verbose ? 99 : 3)) {
      L.push(`?  ${f.id.padEnd(9)} could not check — ${f.detail || 'reason unknown'}`);
      L.push(`   ${' '.repeat(9)} checking for: ${f.problem} · not counted as a pass`);
    }
    if (!opts.verbose && unknowns.length > 3) L.push(`?  ${unknowns.length - 3} more (--verbose)`);
    L.push('');
  }

  if (c.skipped) {
    const byEngine = {};
    for (const r of result.skippedRules) (byEngine[r.region] ||= []).push(r.id);
    for (const [eng, ids] of Object.entries(byEngine)) {
      L.push(`⏭ ${ids.length} optional ${ENGINE_LABEL[eng] || eng} items hidden (${ids.join(' · ')}) — add it with --engines to see them`);
    }
    L.push('');
  }

  if (result.meta.stale.length) {
    L.push(`Note: ${result.meta.stale.length} rules have not been re-verified in over 180 days: ${result.meta.stale.join(', ')}`, '');
  }

  const fixable = result.findings.filter((f) => f.status !== 'pass' && f.status !== 'unknown' && f.fixable && !f.optIn).length;
  const manual = result.findings.filter((f) => f.status === 'unknown' && f.todo.length).length + result.skippedRules.length;
  L.push('Next:');
  if (fixable) L.push(`  apply        ${fixable} autofixable (preview)`);
  if (manual) L.push('  todo         work only a human can do');
  if (!fixable && !manual) L.push('  submit       notify IndexNow about new content');

  return strip(L.join('\n'));
}

function block(icon, f) {
  const pad = ' '.repeat(12);
  const out = [`${icon} ${f.id.padEnd(9)} ${f.problem}`];
  if (f.detail) out.push(`${pad}${f.detail}`);
  out.push(...wrap(`→ ${f.action}  [evidence: ${GRADE_LABEL[f.grade]}]`, pad));
  if (f.fixable) out.push(`${pad}→ autofixable${f.optIn ? ' (opt-in)' : ''}`);
  return out;
}

function wrap(text, pad, width = 78) {
  const words = text.split(' ');
  const lines = [];
  let cur = pad;
  for (const w of words) {
    if ((cur + w).length > width && cur.trim()) { lines.push(cur); cur = pad + '  '; }
    cur += w + ' ';
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// Strip decoration when not a TTY (it is wasted tokens when an agent reads it)
const strip = (s) => (isTTY() ? s : s.replace(/[ \t]+$/gm, ''));

export function renderJson(result, facts) {
  return JSON.stringify({
    tool: 'spb-seo-geo', version: '0.1.0',
    target: facts.baseUrl, framework: facts.framework || null,
    engines: { selected: facts.engines.engines, answered: facts.engines.answered, suggested: facts.engines.suggested },
    counts: result.counts,
    findings: result.findings.map(({ id, engine, severity, grade, status, detail, problem, action, evidence, fixable, fix }) =>
      ({ id, engine, severity, grade, status, detail, problem, action, evidence, fixable, fix })),
    skipped: result.skippedRules,
    stale: result.meta.stale,
  }, null, 2);
}
