#!/usr/bin/env node
// Work only a human can do. Non-autofixable items, in dependency order.
import { parseArgs, readPositionals, out, log, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';

const ENGINE_ORDER = ['google', 'bing', 'core', 'ai', 'naver', 'yahoo'];
const ENGINE_LABEL = { naver: 'Naver', google: 'Google', bing: 'Bing', core: 'Common', ai: 'AI search', yahoo: 'Yahoo' };
const OPT_LABEL = { naver: 'Naver (Korea)', yahoo: 'Yahoo! JAPAN (Japan)' };
const OPT_NOTE = { naver: 'do these in order or they will not take effect' };
const DONE_HINT = 'Already done any of these? Silence it with --done <ID>';

const args = parseArgs();
readPositionals(args);

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

  const suggestedEngines = Object.keys(facts.engines.suggested || {});
  const chosen = facts.engines.answered ? facts.engines.engines : suggestedEngines;
  const showYahoo = chosen.includes('yahoo');
  // What was not chosen still has to be discoverable. A .kr site may be going after Japan.
  const unchosen = ['naver', 'yahoo'].filter((e) => !chosen.includes(e));

  if (regional.length || showYahoo) {
    L.push('Optional engines');
    if (!facts.engines.answered && suggestedEngines.length) {
      L.push(`  (not chosen yet — signals suggest ${suggestedEngines.map((k) => OPT_LABEL[k]).join(' and ')}; choose with --engines)`);
    }
    if (unchosen.length) L.push(`  Also available: ${unchosen.map((e) => OPT_LABEL[e]).join(' · ')} — add with --engines ${[...chosen, ...unchosen].join(',')}`);
    L.push('');
    for (const eng of ['naver', 'yahoo']) {
      const group = regional.filter((i) => i.region === eng);
      if (group.length) {
        print(group, `  ${OPT_LABEL[eng]}`, OPT_NOTE[eng]);

      } else if (eng === 'yahoo' && showYahoo) {
        // Answering "yes, Yahoo" must produce something, or it was a fake question.
        // What it produces is the answer: there is nothing to register, and here is why.
        L.push(`  ${OPT_LABEL.yahoo}`);
        L.push("     · Nothing to register — Yahoo! JAPAN has no webmaster console of its own.");
        L.push("     · Yahoo! JAPAN web search runs on Google's index, so the Google items above already cover ranking and indexing. Submit your sitemap through Google Search Console.");
        L.push('     · Yahoo outside Japan runs on Bing, so the Bing items cover that.');
        L.push("     · The one Yahoo-specific check is already in the audit: keep its own Y!J-* crawlers unblocked (YAHOO-01).");
        L.push('');
      }
    }
  }

  if (items.some((i) => /Already done\?/.test(i.note || ''))) L.push(DONE_HINT, '');
  L.push(`Verified or handled automatically: ${result.counts.pass}`);
  if (auto) L.push(`Still autofixable: ${auto} → apply`);
  out(L.join('\n'));
  process.exit(EXIT.OK);
} catch (e) {
  log('execution error:', String(e?.stack || e));
  process.exit(EXIT.ERROR);
}
