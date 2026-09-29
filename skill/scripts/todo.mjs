#!/usr/bin/env node
// Work only a human can do. Non-autofixable items, in dependency order.
import { parseArgs, out, log, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';

const ENGINE_ORDER = ['naver', 'google', 'bing', 'core', 'ai'];  // Naver takes longest to take effect -> list it first
const ENGINE_LABEL = { naver: 'Naver', google: 'Google', bing: 'Bing', core: 'Common', ai: 'AI search' };

const args = parseArgs();

try {
  const { facts, result } = await run(args);

  // Human's share: unknown findings carrying todos, Naver rules skipped by market, and non-autofixable failures
  const items = [];
  for (const f of result.findings) {
    if (f.todo.length) { for (const t of f.todo) items.push({ ...t, id: f.id, engine: f.engine }); continue; }
    if (f.status === 'pass' || f.status === 'unknown') continue;
    if (!f.fixable) items.push({ label: f.problem, note: f.action, id: f.id, engine: f.engine, minutes: null });
  }

  const auto = result.findings.filter((f) => f.fixable && f.status !== 'pass' && f.status !== 'unknown' && !f.optIn).length;

  if (!items.length) {
    out(['No manual work left.', `${auto} autofixable${auto ? ' → apply' : ''}`, 'Published something new? Announce it with submit.'].join('\n'));
    process.exit(EXIT.OK);
  }

  const total = items.reduce((a, i) => a + (i.minutes || 0), 0);
  const L = [`${items.length} things only a human can do${total ? ` · about ${total} min` : ''}`, ''];

  if (facts.market.market !== 'kr') {
    L.push('Note: Naver tasks are excluded because this site was not judged to target Korea. Pass --market=kr if it does.', '');
  }

  for (const engine of ENGINE_ORDER) {
    const group = items.filter((i) => i.engine === engine);
    if (!group.length) continue;
    L.push(`${ENGINE_LABEL[engine]}${engine === 'naver' ? '  — do these in order or they will not take effect' : ''}`);
    group.forEach((i, n) => {
      L.push(`  ${n + 1}. [ ] ${i.label}${i.minutes ? `   ${i.minutes} min` : ''}${i.url ? `   ${i.url}` : ''}`);
      if (i.note) L.push(`         → ${i.note}`);
    });
    if (engine === 'naver') L.push('         ⏳ After submitting the sitemap, indexing takes about two weeks — not appearing during that window is normal');
    L.push('');
  }

  const passed = result.counts.pass;
  L.push(`Verified or handled automatically: ${passed}`);
  if (auto) L.push(`Still autofixable: ${auto} → apply`);
  out(L.join('\n'));
  process.exit(EXIT.OK);
} catch (e) {
  log('execution error:', String(e?.stack || e));
  process.exit(EXIT.ERROR);
}
