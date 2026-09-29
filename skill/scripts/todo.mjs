#!/usr/bin/env node
// Work only a human can do. Non-autofixable items, in dependency order.
import { parseArgs, out, log, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';

const ENGINE_ORDER = ['google', 'bing', 'core', 'ai', 'naver', 'yahoo'];
const ENGINE_LABEL = { naver: 'Naver', google: 'Google', bing: 'Bing', core: 'Common', ai: 'AI search', yahoo: 'Yahoo' };
const REGION_LABEL = { kr: 'Korea — Naver', jp: 'Japan — Yahoo! JAPAN' };
const REGION_NOTE = {
  kr: 'do these in order or they will not take effect',
  jp: "Yahoo! JAPAN web search runs on Google's index, so the Google items above already cover ranking. There is no separate console — submit through Search Console. Yahoo outside Japan runs on Bing.",
};

const args = parseArgs();

try {
  const { facts, result } = await run(args);

  // Human's share: unknown findings carrying todos, plus anything non-autofixable
  const items = [];
  for (const f of result.findings) {
    if (f.todo.length) { for (const t of f.todo) items.push({ ...t, id: f.id, engine: f.engine, region: f.region }); continue; }
    if (f.status === 'pass' || f.status === 'unknown') continue;
    if (!f.fixable) items.push({ label: f.problem, note: f.action, id: f.id, engine: f.engine, region: f.region, minutes: null });
    else if (f.optIn) items.push({ label: f.problem, note: f.action, id: f.id, engine: f.engine, region: f.region, minutes: null });
  }

  const auto = result.findings.filter((f) => f.fixable && f.status !== 'pass' && f.status !== 'unknown' && !f.optIn).length;

  if (!items.length) {
    out(['No manual work left.', `${auto} autofixable${auto ? ' → apply' : ''}`, 'Published something new? Announce it with submit.'].join('\n'));
    process.exit(EXIT.OK);
  }

  const core = items.filter((i) => !i.region);
  const regional = items.filter((i) => i.region);
  const total = core.reduce((a, i) => a + (i.minutes || 0), 0);
  const L = [`${items.length} things only a human can do${total ? ` · about ${total} min for the required ones` : ''}`, ''];

  const print = (group, heading, sub) => {
    if (!group.length) return;
    L.push(heading);
    if (sub) L.push(`  ${sub}`);
    group.forEach((i, n) => {
      L.push(`  ${n + 1}. [ ] ${i.label}${i.minutes ? `   ${i.minutes} min` : ''}${i.url ? `   ${i.url}` : ''}`);
      if (i.note) L.push(`         → ${i.note}`);
    });
    L.push('');
  };

  for (const engine of ENGINE_ORDER) {
    const group = core.filter((i) => i.engine === engine);
    print(group, ENGINE_LABEL[engine]);
  }

  if (regional.length) {
    const sug = Object.keys(facts.market.suggested || {});
    L.push('Optional — only if you want traffic from these countries');
    if (sug.length) L.push(`  (signals on this site suggest ${sug.map((k) => REGION_LABEL[k]).join(' and ')} may apply to you)`);
    L.push('');
    for (const rg of ['kr', 'jp']) {
      const group = regional.filter((i) => i.region === rg);
      if (group.length) print(group, `  ${REGION_LABEL[rg]}`, REGION_NOTE[rg]);
      if (group.length && rg === 'kr') L.push('     ⏳ After submitting the sitemap, indexing takes about two weeks — not appearing during that window is normal', '');
    }
  }

  L.push(`Verified or handled automatically: ${result.counts.pass}`);
  if (auto) L.push(`Still autofixable: ${auto} → apply`);
  out(L.join('\n'));
  process.exit(EXIT.OK);
} catch (e) {
  log('execution error:', String(e?.stack || e));
  process.exit(EXIT.ERROR);
}
