#!/usr/bin/env node
// What do we still not know? The script works that out; the agent does the asking.
//
// Same boundary as everywhere else: verdicts and state are deterministic, conversation
// belongs to the agent. It asks one question at a time, in this order, and never asks
// again for anything already saved.
import { parseArgs, out, EXIT } from './lib/args.mjs';
import { findRoot, loadConfig } from './lib/config.mjs';
import { detectSiteUrl, detectAccessLog } from './lib/site.mjs';
import { detectFramework } from './lib/framework.mjs';
import { parseEngines, OPTIONAL_ENGINES, LABEL } from './lib/engines.mjs';

const args = parseArgs();
const root = args.dir ? String(args.dir) : findRoot();
const cfg = loadConfig(root);
const fw = detectFramework(root);

const detectedUrl = cfg.url ? null : detectSiteUrl(root);
const detectedLog = cfg.accessLog ? null : detectAccessLog(root);
const engines = parseEngines(cfg.engines);
const tokens = cfg.tokens || {};
const haveTokens = ['google', 'bing', 'naver'].filter((k) => tokens[k]);

const steps = [];
const ask = (n, label, state, question, flag) => steps.push({ n, label, state, question, flag });

// 1 — the site. Confirm a detection rather than accepting it silently; ask outright if none.
if (cfg.url) {
  ask(1, 'site URL', `${cfg.url} (saved)`, null, null);
} else if (detectedUrl?.url) {
  ask(1, 'site URL', `${detectedUrl.url} — detected in ${detectedUrl.where}`,
    `Is ${detectedUrl.url} the right address?`, `--url ${detectedUrl.url}`);
} else {
  ask(1, 'site URL', 'unknown', 'What is the deployed address of this site?', '--url <SITE>');
}

// 2, 3 — one engine per question. Never inferred from language.
for (const e of OPTIONAL_ENGINES) {
  const chosen = engines?.includes(e);
  const decided = engines !== null;
  ask(steps.length + 1, LABEL[e],
    decided ? (chosen ? 'yes (saved)' : 'no (saved)') : 'not asked',
    decided ? null : `Do you want to cover ${LABEL[e]}?`,
    `--engines ${e}`);
}

// 4 — a value judgement, so it is always the user's call.
ask(4, 'AI training policy', cfg.aiPolicy ? `${cfg.aiPolicy} (saved)` : 'not asked',
  cfg.aiPolicy ? null : 'Allow AI companies to train on this site? open (allow, max visibility) / cite-only (block training, stay citable in AI answers) / closed (block both — you disappear from AI answers)',
  '--ai-policy open|cite-only|closed');

// 5 — the one thing that turns apply from advice into action.
ask(5, 'verification tokens', haveTokens.length ? `${haveTokens.join(', ')} (saved)` : 'none',
  haveTokens.length === 3 ? null : `Do you have verification tokens for ${['google', 'bing', 'naver'].filter((k) => !tokens[k]).join(', ')}? (the "HTML tag" string in each console — skip any you have not signed up for)`,
  '--google-token X --bing-token X --naver-token X');

// 6 — without it, GEO is theory.
ask(6, 'access log', cfg.accessLog ? `${cfg.accessLog} (saved)` : (detectedLog ? `${detectedLog} — found in the repo` : 'none'),
  cfg.accessLog ? null : (detectedLog ? `Use ${detectedLog} to measure AI crawler activity?` : 'Is there a server access log anywhere? It is the only way to measure whether AI crawlers actually fetch the site.'),
  '--access-log <file>');

// 7 — optional artefacts, so ask rather than generate.
const extras = [cfg.withRss && 'rss', cfg.withLlmsTxt && 'llms.txt'].filter(Boolean);
ask(7, 'optional files', extras.length ? extras.join(', ') : 'none',
  (cfg.withRss || cfg.withLlmsTxt) ? null : 'Generate an RSS feed (Naver still uses it) and/or llms.txt (Google says it is unnecessary)?',
  '--with-rss --with-llms-txt');

const pending = steps.filter((s) => s.question);
const L = [`Intake — ${pending.length ? `${pending.length} still to ask` : 'complete'}   (${cfg._exists ? cfg._path.replace(root + '/', '') : 'no config yet'})`, ''];
for (const s of steps) {
  L.push(`  ${s.question ? '?' : '✔'} ${String(s.label).padEnd(22)} ${s.state}`);
  if (s.question) L.push(`     ask: ${s.question}`);
}
L.push('');
if (pending.length) {
  L.push('Ask ONE question at a time, in the order above, and wait for each answer.');
  L.push('Skip anything the user does not have. Then save every answer in a single call:');
  L.push('');
  const parts = [];
  if (!cfg.url) parts.push(detectedUrl?.url ? `--url ${detectedUrl.url}` : '--url <SITE>');
  if (engines === null) parts.push('--engines <naver,yahoo|none>');
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
L.push('', `framework: ${fw.name || 'unknown'}`);
out(L.join('\n'));
process.exit(EXIT.OK);
