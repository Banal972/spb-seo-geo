// Shared setup for scan/apply/todo. No caching: verdicts always reflect the current state.
import { findRoot, loadConfig, saveConfig } from './config.mjs';
import { join } from 'node:path';

import { detectFramework } from './framework.mjs';
import { detectSiteUrl, detectAccessLog } from './site.mjs';
import { collect, collectLocalFiles } from './collect.mjs';
import { log } from './args.mjs';
import { judge } from './judge.mjs';

export async function run(args) {
  const repoRoot = args.dir ? String(args.dir) : findRoot();
  const config = loadConfig(repoRoot);
  // In a monorepo the answers belong to one app. The config lives at the repo root so the
  // choice is remembered, but everything else resolves inside the chosen app.
  const app = args.app ? String(args.app) : config.app || null;
  const root = app ? join(repoRoot, app) : repoRoot;
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
  facts.local = collectLocalFiles(root, fw);
  facts.fw = fw;
  facts.framework = fw.name;

  const aiPolicy = String(args['ai-policy'] || config.aiPolicy || 'open');
  // No engine filter unless the user actually chose.
  const filter = facts.engines.answered ? facts.engines.engines : null;
  // "I already did that" is information we should keep, not ask about twice.
  let completed = Array.isArray(config.completed) ? config.completed : [];
  if (args.done) {
    const add = String(args.done).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    completed = [...new Set([...completed, ...add])];
    saveConfig({ completed }, repoRoot);
  }

  const only = args.only ? String(args.only).toLowerCase() : null;
  const result = judge(facts, { engines: filter, aiPolicy, only, completed });
  facts.urlFrom = urlFrom;
  facts.accessLogFrom = args['access-log'] ? '--access-log' : (config.accessLog ? 'saved config' : (accessLog ? 'auto-detected' : null));
  facts.app = app;
  return { facts, result, config, root, repoRoot, app, fw, aiPolicy, url, only };
}

export function usage(name, lines) {
  return [`spb-seo-geo ${name}`, '', ...lines, ''].join('\n');
}
