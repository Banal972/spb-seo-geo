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
    'open      — training allowed. Bet: a model may absorb the brand and mention it without searching (grade: low, unverified). Cost: your content becomes training data and can be paraphrased without a link.',
    'cite-only — training blocked, citation kept. You still appear as a source with a link. Costs you the bet above, and blocking Google-Extended may drop Gemini-app grounding.',
    'closed    — both blocked. You disappear from AI answers. Only pick this if that is the goal.',
    'Search ranking is identical in all three — Google states Google-Extended is training only.',
  ],
  tokens: [
    'With a token we place the ownership tag for you (or emit the exact snippet for your framework). Without it, you get a "go fetch it" item instead.',
    'Skip any console you have not signed up for. Already verified by DNS or by an uploaded file? Say so — a committed verification file is detected automatically.',
  ],
  log: [
    'This is the only way to know whether AI crawlers actually fetch the site. Being allowed in robots.txt proves nothing.',
    'It reports which citation bots came and when, and whether a real person opened your link inside ChatGPT or Claude — the strongest evidence AI answers send traffic.',
  ],
  extras: [
    'RSS      — Naver still treats it as a first-class input, so worth it if you publish regularly. Our feed is static, so it goes stale unless your build regenerates it. Pointless for a landing page.',
    'llms.txt — helps coding agents read your docs (Anthropic and OpenAI use it that way). No search or AI-visibility effect: Google says it is unnecessary, and 97% of llms.txt files measured had zero traffic. Worth it for a docs site, not for marketing.',
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

// 2, 3 — one engine per question. Never inferred from language.
for (const e of OPTIONAL_ENGINES) {
  const chosen = engines?.includes(e);
  const decided = engines !== null;
  ask(steps.length + 1, LABEL[e],
    decided ? (chosen ? 'yes (saved)' : 'no (saved)') : 'not asked',
    decided ? null : `Do you want to cover ${LABEL[e]}?`,
    `--engines ${e}`, EXPLAIN.engines[e]);
}

// 4 — a value judgement, so it is always the user's call.
ask(4, 'AI training policy', cfg.aiPolicy ? `${cfg.aiPolicy} (saved)` : 'not asked',
  cfg.aiPolicy ? null : 'Allow AI companies to train on this site? open / cite-only / closed',
  '--ai-policy open|cite-only|closed', EXPLAIN.policy);

// 5 — the one thing that turns apply from advice into action.
ask(5, 'verification tokens', haveTokens.length ? `${haveTokens.join(', ')} (saved)` : 'none',
  haveTokens.length === 3 ? null : `Do you have verification tokens for ${['google', 'bing', 'naver'].filter((k) => !tokens[k]).join(', ')}? (the "HTML tag" string in each console — skip any you have not signed up for)`,
  '--google-token X --bing-token X --naver-token X', EXPLAIN.tokens);

// 6 — without it, GEO is theory.
ask(6, 'access log', cfg.accessLog ? `${cfg.accessLog} (saved)` : (detectedLog ? `${detectedLog} — found in the repo` : 'none'),
  cfg.accessLog ? null : (detectedLog ? `Use ${detectedLog} to measure AI crawler activity?` : 'Is there a server access log anywhere? It is the only way to measure whether AI crawlers actually fetch the site.'),
  '--access-log <file>', EXPLAIN.log);

// 7 — optional artefacts, so ask rather than generate.
const extras = [cfg.withRss && 'rss', cfg.withLlmsTxt && 'llms.txt'].filter(Boolean);
ask(7, 'optional files', extras.length ? extras.join(', ') : 'none',
  (cfg.withRss || cfg.withLlmsTxt) ? null : 'Generate an RSS feed (Naver still uses it) and/or llms.txt (Google says it is unnecessary)?',
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
L.push('', `framework: ${fw.name || 'unknown'}${fw.fromWorkspace ? ` (${fw.fromWorkspace})` : ''}${picked ? ` · app ${picked}` : ''}`);
out(L.join('\n'));
process.exit(EXIT.OK);
