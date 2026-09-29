// Shared setup for scan/apply/todo. No caching: verdicts always reflect the current state.
import { findRoot, loadConfig } from './config.mjs';

import { detectFramework } from './framework.mjs';
import { detectSiteUrl, detectAccessLog } from './site.mjs';
import { collect } from './collect.mjs';
import { log } from './args.mjs';
import { judge } from './judge.mjs';

export async function run(args) {
  const root = args.dir ? String(args.dir) : findRoot();
  const config = loadConfig(root);
  const fw = detectFramework(root);
  // Anything inferable must not be a question.
  let url = args.url ? String(args.url) : config.url || null;
  let urlFrom = args.url ? '--url' : (config.url ? 'saved config' : null);
  if (!url) {
    const found = detectSiteUrl(root);
    if (found.url) { url = found.url; urlFrom = `detected in ${found.where}`; }
  }
  const accessLog = args['access-log'] || config.accessLog || detectAccessLog(root);

  const facts = await collect({
    url, config,
    options: {
      engines: args.engines ?? args.market,
      accessLog,
      logWindow: args['log-window'] || config.logWindow,
    },
  });
  facts.dir = root;
  facts.fw = fw;
  facts.framework = fw.name;

  const aiPolicy = String(args['ai-policy'] || config.aiPolicy || 'open');
  // No engine filter unless the user actually chose.
  const filter = facts.engines.answered ? facts.engines.engines : null;
  const only = args.only ? String(args.only).toLowerCase() : null;
  const result = judge(facts, { engines: filter, aiPolicy, only });
  facts.urlFrom = urlFrom;
  facts.accessLogFrom = args['access-log'] ? '--access-log' : (config.accessLog ? 'saved config' : (accessLog ? 'auto-detected' : null));
  return { facts, result, config, root, fw, aiPolicy, url, only };
}

export function usage(name, lines) {
  return [`spb-seo-geo ${name}`, '', ...lines, ''].join('\n');
}
