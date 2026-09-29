// Shared setup for scan/apply/todo. No caching: verdicts always reflect the current state.
import { findRoot, loadConfig, saveConfig } from './config.mjs';
import { parseMarkets } from './market.mjs';
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

  // Remember the user's answer only when they ask for it — scan itself stays side-effect free.
  if (args.save) {
    const m = parseMarkets(args.market);
    if (m) saveConfig({ market: m.join(',') || 'global' }, root);
  }

  const aiPolicy = String(args['ai-policy'] || config.aiPolicy || 'open');
  const result = judge(facts, { markets: facts.market.markets, aiPolicy });
  return { facts, result, config, root, fw, aiPolicy, url };
}

export function usage(name, lines) {
  return [`spb-seo-geo ${name}`, '', ...lines, ''].join('\n');
}
