// Shared setup for scan/apply/todo. No caching: verdicts always reflect the current state.
import { findRoot, loadConfig } from './config.mjs';
import { detectFramework } from './framework.mjs';
import { collect } from './collect.mjs';
import { judge } from './judge.mjs';

export async function run(args) {
  const root = args.dir ? String(args.dir) : findRoot();
  const config = loadConfig(root);
  const fw = detectFramework(root);
  const url = args.url ? String(args.url) : config.url || null;

  const facts = await collect({ url, config, options: { market: args.market } });
  facts.dir = root;
  facts.fw = fw;
  facts.framework = fw.name;

  const aiPolicy = String(args['ai-policy'] || config.aiPolicy || 'open');
  const result = judge(facts, { market: facts.market.market, aiPolicy });
  return { facts, result, config, root, fw, aiPolicy, url };
}

export function usage(name, lines) {
  return [`spb-seo-geo ${name}`, '', ...lines, ''].join('\n');
}
