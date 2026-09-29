#!/usr/bin/env node
// Scan and compact report. This output is the only thing the agent reads.
import { parseArgs, out, log, exitWith, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';
import { renderScan, renderJson } from './lib/render.mjs';

const args = parseArgs();

if (args.help) {
  out([
    'spb-seo-geo scan — audit search and AI visibility',
    '',
    '  node scan.mjs --url https://example.com [--dir .] [--engines naver,yahoo|none]',
    '                [--json] [--verbose] [--ai-policy open|cite-only|closed]',
    '',
    'Exit codes: 0 all clear · 1 critical failure · 2 warnings only · 3 execution error',
  ].join('\n'));
  process.exit(EXIT.OK);
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
