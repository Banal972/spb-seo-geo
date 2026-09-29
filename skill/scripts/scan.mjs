#!/usr/bin/env node
// Scan and compact report. This output is the only thing the agent reads.
import { parseArgs, readPositionals, out, log, exitWith, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';
import { renderScan, renderJson } from './lib/render.mjs';

const args = parseArgs();
const unknown = readPositionals(args);

if (args.help) {
  out([
    'spb-seo-geo scan — audit search and AI visibility',
    '',
    '  node scan.mjs                     audit this project; the site URL is detected',
    '  node scan.mjs seo | geo           only one half',
    '  node scan.mjs example.com         audit a URL directly',
    '',
    '  node scan.mjs [--url URL] [--dir .] [--engines naver,yahoo|none]',
    '                [--json] [--verbose] [--ai-policy open|cite-only|closed]',
    '',
    'Exit codes: 0 all clear · 1 critical failure · 2 warnings only · 3 execution error',
  ].join('\n'));
  process.exit(EXIT.OK);
}

if (unknown.length) {
  log(`! ignoring unrecognised argument: ${unknown.join(' ')} — expected "seo", "geo" or a site address`);
}

try {
  const { facts, result } = await run(args);
  if (!facts.remote) log('! No deployed URL given — remote rules stay unchecked (?). Pass --url.');
  out(args.json ? renderJson(result, facts) : renderScan(result, facts, { verbose: !!args.verbose }));
  process.exit(exitWith(result.counts));
} catch (e) {
  log('execution error:', String(e?.stack || e));
  out('The audit did not complete. See the error above.');
  process.exit(EXIT.ERROR);
}
