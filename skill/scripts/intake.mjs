#!/usr/bin/env node
// What do we still not know? The script works that out; the agent does the asking.
//
// Same boundary as everywhere else: verdicts and state are deterministic, conversation
// belongs to the agent. It asks one question at a time, in this order, and never asks
// again for anything already saved.
import { parseArgs, out, EXIT } from './lib/args.mjs';
import { findRoot, loadConfig } from './lib/config.mjs';
import { detectSiteUrl, detectAccessLog } from './lib/site.mjs';
import { detectFramework, detectApps } from './lib/framework.mjs';
import { parseEngines, OPTIONAL_ENGINES, LABEL } from './lib/engines.mjs';
import { join } from 'node:path';

const args = parseArgs();
const root = args.dir ? String(args.dir) : findRoot();
const cfg = loadConfig(root);
const apps = detectApps(root);
const picked = cfg.app || (args.app ? String(args.app) : null);
const appRoot = picked ? join(root, picked) : (apps.length === 1 ? apps[0].dir : root);
const fw = detectFramework(appRoot);

const detectedUrl = cfg.url ? null : detectSiteUrl(appRoot);
const detectedLog = cfg.accessLog ? null : detectAccessLog(appRoot);
const engines = parseEngines(cfg.engines);
const tokens = cfg.tokens || {};
const haveTokens = ['google', 'bing', 'naver'].filter((k) => tokens[k]);

const steps = [];
// A question without its consequences is not a real question. Each choice carries the
// tradeoff, so the agent presents it instead of improvising or asking the user to guess.
const ask = (n, label, state, question, flag, explain) => steps.push({ n, label, state, question, flag, explain });

const EXPLAIN = {
  policy: [
    'yes (open) — anything goes. A model may end up knowing your brand without looking it up, though nobody can prove that per site. Your text can also be reused without a link back.',
    'no (cite-only) — AI can still quote you and link to you in its answers; it just cannot train on your text. Most people want this.',
    'Either way your Google ranking is exactly the same — Google says so itself.',
    'If they want out of AI answers entirely, that is a third option (closed), but say plainly that the site then disappears from them.',
  ],
  tokens: [
    'If you have that string, it goes into the site for you. If not, skip — it becomes a step in the to-do list with the link.',
    'Never signed up? That is fine and normal; skip and the to-do list walks you through it.',
  ],
  log: [
    'It reports which citation bots came and when, and whether a real person opened your link inside ChatGPT or Claude — the strongest evidence that AI answers send traffic. Being allowed in robots.txt proves nothing on its own.',
  ],
  extras: [
    'If yes, an RSS feed is worth generating (--with-rss): Naver still reads them, and it is how new posts get noticed sooner. It is a static file, so your build has to regenerate it.',
    'If this is a landing page or a shop, skip it — there is nothing to feed.',
    'Separately, llms.txt (--with-llms-txt) only helps if you publish developer documentation. Google says it is unnecessary and 97% of measured files saw zero traffic, so do not offer it otherwise.',
  ],
  engines: {
    naver: ['Korea\'s dominant engine plus its AI Briefing surface. Costs four console steps in a fixed order, and indexing takes a couple of weeks.'],
    yahoo: ['Nothing to register — Yahoo! JAPAN runs on Google\'s index, so your Google work already covers it. Choosing it just gets you that explanation.'],
  },
};

// 0 — a monorepo usually holds several sites, each with its own domain. Never pick one
// silently: the wrong choice makes every later answer wrong too.
if (apps.length > 1 && !picked) {
  const lines = apps.map((a) => {
    const u = detectSiteUrl(a.dir);
    return `${a.rel} (${a.name}${u.url ? ` → ${u.url}` : ''})`;
  });
  ask(0, 'which site', `${apps.length} apps in this repo`,
    `This repo holds several sites — which one? ${lines.join(' · ')}`, `--app ${apps[0].rel}`);
} else if (picked) {
  ask(0, 'which site', `${picked} (saved)`, null, null);
}

// 1 — the site. Confirm a detection rather than accepting it silently; ask outright if none.
if (cfg.url) {
  ask(1, 'site URL', `${cfg.url} (saved)`, null, null);
} else if (detectedUrl?.url) {
  ask(1, 'site URL', `${detectedUrl.url} — detected in ${detectedUrl.where}`,
    `Is ${detectedUrl.url} the right address?`, `--url ${detectedUrl.url}`);
} else {
  ask(1, 'site URL', 'unknown', 'What is the deployed address of this site?', '--url <SITE>');
}

// Engines are NOT asked. Every rule runs for every site either way; the only thing a
// choice changes is whether a few advisory lines show up in todo. Every other question
// here changes what gets written or evaluated — this one did not earn its place. Both
// engines stay named in the report and in todo, so saying "we do not do Naver" any time
// still works via --engines.
ask(2, 'optional engines', engines ? (engines.join(', ') || 'none (saved)') : 'not chosen — both listed as available',
  null, null);

// 4 — a value judgement, so it is always the user's call.
ask(4, 'AI training policy', cfg.aiPolicy ? `${cfg.aiPolicy} (saved)` : 'not asked',
  cfg.aiPolicy ? null : 'Is it fine for AI companies to learn from your content? (yes / no)',
  '--ai-policy open|cite-only|closed', EXPLAIN.policy);

// 5 — the one thing that turns apply from advice into action.
ask(5, 'verification tokens', haveTokens.length ? `${haveTokens.join(', ')} (saved)` : 'none',
  haveTokens.length === 3 ? null : `Have you registered this site with ${['google', 'bing', 'naver'].filter((k) => !tokens[k]).map((k) => ({ google: 'Google Search Console', bing: 'Bing Webmaster Tools', naver: 'Naver Search Advisor' })[k]).join(', ')}? If you are mid-signup, each one shows an "HTML tag" option — paste that string here.`,
  '--google-token X --bing-token X --naver-token X', EXPLAIN.tokens);

// 6 — without it, GEO is theory.
ask(6, 'access log', cfg.accessLog ? `${cfg.accessLog} (saved)` : (detectedLog ? `${detectedLog} — found in the repo` : 'none'),
  cfg.accessLog ? null : (detectedLog ? `Found ${detectedLog} — use it to see which AI crawlers actually visited?` : 'Do you have a server log file anywhere? (most people do not — skip if unsure)'),
  '--access-log <file>', EXPLAIN.log);

// 7 — optional artefacts, so ask rather than generate.
const extras = [cfg.withRss && 'rss', cfg.withLlmsTxt && 'llms.txt'].filter(Boolean);
ask(7, 'optional files', extras.length ? extras.join(', ') : 'none',
  (cfg.withRss || cfg.withLlmsTxt) ? null : 'Does this site publish posts regularly (a blog, news, updates)?',
  '--with-rss --with-llms-txt', EXPLAIN.extras);

const pending = steps.filter((s) => s.question);
const L = [`Intake — ${pending.length ? `${pending.length} still to ask` : 'complete'}   (${cfg._exists ? cfg._path.replace(root + '/', '') : 'no config yet'})`, ''];
for (const s of steps) {
  L.push(`  ${s.question ? '?' : '✔'} ${String(s.label).padEnd(22)} ${s.state}`);
  if (s.question) {
    L.push(`     ask: ${s.question}`);
    for (const line of s.explain || []) L.push(`          ${line}`);
  }
}
L.push('');
if (pending.length) {
  L.push('Ask ONE question at a time, in the order above, and wait for each answer.');
  L.push('Give the tradeoff with the question — a choice without its cost is not a choice.');
  L.push('If they dig further, references/choices.md has the evidence behind each one.');
  L.push('Skip anything the user does not have. Then save every answer in a single call:');
  L.push('');
  const parts = [];
  if (apps.length > 1 && !picked) parts.push(`--app <${apps.map((a) => a.rel).join('|')}>`);
  if (!cfg.url) parts.push(detectedUrl?.url ? `--url ${detectedUrl.url}` : '--url <SITE>');
  if (!cfg.aiPolicy) parts.push('--ai-policy <open|cite-only|closed>');
  for (const k of ['google', 'bing', 'naver']) if (!tokens[k]) parts.push(`[--${k}-token X]`);
  if (!cfg.accessLog) parts.push(detectedLog ? `[--access-log ${detectedLog}]` : '[--access-log <file>]');
  if (!cfg.withRss) parts.push('[--with-rss]');
  if (!cfg.withLlmsTxt) parts.push('[--with-llms-txt]');
  L.push(`  node <DIR>/scripts/setup.mjs ${parts.join(' ')}`);
  L.push('');
  L.push('Drop anything in [brackets] the user does not want. Add --write once they have');
  L.push('approved the file preview that setup prints.');
} else {
  L.push('Nothing left to ask. Run scan.mjs (add --write to apply).');
}
L.push('', `framework: ${fw.name || 'unknown'}${fw.fromWorkspace ? ` (${fw.fromWorkspace})` : ''}${picked ? ` · app ${picked}` : ''}`);
out(L.join('\n'));
process.exit(EXIT.OK);
