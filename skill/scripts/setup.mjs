#!/usr/bin/env node
// One-time intake, then the whole setup in one pass.
//
// The point: collect everything that cannot be inferred — the URL, which countries
// matter, the console verification tokens — BEFORE doing any work. With those in hand
// apply can finish the job instead of handing half of it back as "add this yourself".
import { parseArgs, out, log, EXIT } from './lib/args.mjs';
import { findRoot, loadConfig, saveConfig } from './lib/config.mjs';
import { parseMarkets, MARKETS } from './lib/market.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = parseArgs();

if (args.help || (!args.url && !loadConfig(findRoot()).url)) {
  out([
    'spb-seo-geo setup — answer once, then everything is configured from those answers',
    '',
    '  node setup.mjs --url https://example.com \\',
    '                 [--market kr,jp|global] [--ai-policy open|cite-only|closed] \\',
    '                 [--google-token X] [--bing-token X] [--naver-token X] \\',
    '                 [--with-rss] [--with-llms-txt] [--write]',
    '',
    'Ask the user for these first (see SKILL.md → Intake). Everything is saved to',
    '.spb-seo-geo.json, so later runs of scan/apply/todo need no flags at all.',
    '',
    'Without --write nothing is changed: you get the audit plus a preview of every file.',
  ].join('\n'));
  process.exit(args.help ? EXIT.OK : EXIT.ERROR);
}

const root = args.dir ? String(args.dir) : findRoot();
const prev = loadConfig(root);
const patch = {};

if (args.url) patch.url = String(args.url);
const market = parseMarkets(args.market);
if (market) patch.market = market.join(',') || 'global';
if (args['ai-policy']) patch.aiPolicy = String(args['ai-policy']);
if (args['with-rss']) patch.withRss = true;
if (args['with-llms-txt']) patch.withLlmsTxt = true;

// Verification tokens end up in the page source anyway, so storing them is safe and
// means apply can place the tags on every later run without asking again.
const tokens = { ...(prev.tokens || {}) };
for (const k of ['google', 'bing', 'naver']) {
  const v = args[`${k}-token`];
  if (v) tokens[k] = String(v);
}
if (Object.keys(tokens).length) patch.tokens = tokens;

const path = saveConfig(patch, root);
const cfg = loadConfig(root);

const L = ['Saved to ' + path.replace(root + '/', ''), ''];
L.push(`  site        ${cfg.url}`);
L.push(`  markets     ${cfg.market || 'not set — all optional regional steps will be listed'}`);
L.push(`  ai-policy   ${cfg.aiPolicy || 'open (default)'}`);
L.push(`  tokens      ${['google', 'bing', 'naver'].filter((k) => cfg.tokens?.[k]).join(', ') || 'none yet'}`);
const extras = [cfg.withRss && 'rss', cfg.withLlmsTxt && 'llms.txt'].filter(Boolean);
if (extras.length) L.push(`  also build  ${extras.join(', ')}`);
out(L.join('\n'));

const pass = ['--dir', root];
if (args.verbose) pass.push('--verbose');

const step = (name, extra = []) => {
  out('\n' + '─'.repeat(64) + `\n${name}\n`);
  const r = spawnSync(process.execPath, [join(HERE, `${name}.mjs`), ...pass, ...extra], { stdio: 'inherit' });
  return r.status ?? EXIT.ERROR;
};

const scanStatus = step('scan');
step('apply', args.write ? ['--write'] : []);
step('todo');

out('\n' + '─'.repeat(64));
out(args.write
  ? 'Setup applied. Deploy, then run scan again to confirm against the live site.'
  : 'Nothing was changed. Re-run with --write to apply, once you are happy with the preview above.');
process.exit(scanStatus);
