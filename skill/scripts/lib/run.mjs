// Shared setup for scan/apply/todo. No caching: verdicts always reflect the current state.
import { findRoot, loadConfig } from './config.mjs';

import { detectFramework } from './framework.mjs';
import { collect } from './collect.mjs';
import { log } from './args.mjs';
import { judge } from './judge.mjs';

export async function run(args) {
  const root = args.dir ? String(args.dir) : findRoot();
  const config = loadConfig(root);
  const fw = detectFramework(root);
  const url = args.url ? String(args.url) : config.url || null;
  if (!url && !args.dir) log('! No URL given and none saved. Run setup first, or pass --url.');

  const facts = await collect({
    url, config,
    options: {
      engines: args.engines ?? args.market,
      accessLog: args['access-log'] || config.accessLog,
      logWindow: args['log-window'] || config.logWindow,
    },
  });
  facts.dir = root;
  facts.fw = fw;
  facts.framework = fw.name;

  const aiPolicy = String(args['ai-policy'] || config.aiPolicy || 'open');
  // No engine filter unless the user actually chose.
  const filter = facts.engines.answered ? facts.engines.engines : null;
  const result = judge(facts, { engines: filter, aiPolicy });
  return { facts, result, config, root, fw, aiPolicy, url };
}

export function usage(name, lines) {
  return [`spb-seo-geo ${name}`, '', ...lines, ''].join('\n');
}
