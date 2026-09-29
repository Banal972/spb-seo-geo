#!/usr/bin/env node
// Autofix. Preview by default: nothing is written without --write (invariant 3).
import { parseArgs, out, log, EXIT } from './lib/args.mjs';
import { run } from './lib/run.mjs';
import { saveConfig } from './lib/config.mjs';
import { scanRoutes } from './lib/framework.mjs';
import * as gen from './lib/generate.mjs';
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const args = parseArgs();
const WRITE = !!args.write;

try {
  const { facts, result, config, root, fw, aiPolicy } = await run(args);

  const optIn = (fix) => (fix === 'rss' ? (args['with-rss'] || config.withRss) : fix === 'llmstxt' ? (args['with-llms-txt'] || config.withLlmsTxt) : false);

  const needs = new Set(
    result.findings
      .filter((f) => f.fixable && f.status !== 'pass' && (f.status !== 'unknown' || f.fix?.startsWith('meta-verify')))
      .filter((f) => !f.optIn || optIn(f.fix))
      .map((f) => f.fix)
  );

  if (!fw.confident) {
    out([
      'Not confident about the framework, so no file was written.',
      `  detected: ${fw.name || 'none'} · no public directory candidate found`,
      '  Pass --dir to point at the project, or save the content below yourself.',
      '',
    ].join('\n'));
  }

  const pub = fw.publicDir ? join(root, fw.publicDir) : null;
  const plan = [];   // { path, content, mode: 'create'|'merge', note }
  const snippets = []; // things we cannot safely write to a file (framework metadata APIs, etc.)
  const origin = facts.origin || config.url || '';

  // robots.txt
  if (needs.has('robots')) {
    const target = pub && join(pub, 'robots.txt');
    const existing = target && existsSync(target) ? readFileSync(target, 'utf8')
      : (facts.robots?.res?.ok ? facts.robots.res.body : '');
    const sitemapUrl = origin ? new URL('/sitemap.xml', origin).toString() : null;
    const content = gen.mergeRobots(existing, gen.robotsBlock({ policy: aiPolicy, sitemapUrl }));
    if (target) plan.push({ path: target, content, mode: existsSync(target) ? 'merge' : 'create', note: `ai-policy=${aiPolicy}` });
    // Our block cannot override lines the user wrote elsewhere in the file. Say so instead
    // of letting the fix look complete when it is not.
    const stale = gen.staleBlocks(existing, [...gen.AI_BOTS.cite, ...gen.AI_BOTS.user]);
    if (stale.length) {
      snippets.push({
        title: 'robots.txt — delete these lines yourself (outside our block)',
        body: stale.map((x) => `line ${x.line}: ${x.text}   → blocks ${x.ua}, which our block allows`).join('\n')
          + '\nCompliant crawlers merge the groups and let allow win, but leaving both is ambiguous.',
      });
    }
    else snippets.push({ title: 'robots.txt', body: content });
  }

  // sitemap.xml: leave it alone if a generator plugin already owns it
  if (needs.has('sitemap')) {
    if (fw.hasSitemapPlugin) {
      snippets.push({ title: 'Sitemap', body: 'A sitemap generator plugin is already installed. Check its configuration — we never overwrite it.' });
    } else if (!origin) {
      snippets.push({ title: 'Sitemap', body: 'Generating a sitemap requires the deployed address via --url.' });
    } else {
      const routes = scanRoutes(fw);
      if (routes.length) {
        const target = pub && join(pub, 'sitemap.xml');
        const content = gen.sitemapXml(origin, routes);
        if (target) plan.push({ path: target, content, mode: existsSync(target) ? 'replace' : 'create', note: `${routes.length} URLs` });
        else snippets.push({ title: 'sitemap.xml', body: content });
      } else {
        snippets.push({ title: 'Sitemap', body: 'No static routes found (dynamic routes only). Use your framework\'s own sitemap generator.' });
      }
    }
  }

  // RSS exists for Naver. It is static, so it must be regenerated on each deploy.
  if (needs.has('rss')) {
    const items = (facts.samples.length ? facts.samples : [facts.home])
      .filter((p) => p?.parsed)
      .map((p) => ({ url: p.url, title: p.parsed.title }));
    if (origin && items.length) {
      const target = pub && join(pub, 'rss.xml');
      const content = gen.rssXml({
        origin, title: facts.home?.parsed?.title, description: facts.home?.parsed?.meta?.description, items,
      });
      if (target) plan.push({ path: target, content, mode: existsSync(target) ? 'replace' : 'create', note: `${items.length} items · static` });
      snippets.push({ title: 'Declare the RSS feed in <head>', body: `<link rel="alternate" type="application/rss+xml" href="/rss.xml" />` });
    } else {
      snippets.push({ title: 'RSS', body: 'Generating RSS requires --url.' });
    }
  }

  // IndexNow key
  if (needs.has('indexnow-key')) {
    const key = config.indexNow?.key || gen.indexNowKey();
    const target = pub && join(pub, `${key}.txt`);
    if (target) plan.push({
      path: target, content: gen.indexNowKeyFile(key), mode: 'create',
      note: config.indexNow?.key ? 'IndexNow key' : 'IndexNow key — the real key is generated when you pass --write',
      config: { indexNow: { key } },
    });
    else snippets.push({ title: `${key}.txt (site root)`, body: key });
  }

  // Ownership verification meta: only when a token was provided
  const tok = config.tokens || {};
  const wanted = { google: args['google-token'] || tok.google, naver: args['naver-token'] || tok.naver, bing: args['bing-token'] || tok.bing };
  const NEEDS_VERIFY = { 'meta-verify-google': 'google', 'meta-verify-naver': 'naver', 'meta-verify-bing': 'bing' };
  const have = {}, missing = [];
  for (const [fix, key] of Object.entries(NEEDS_VERIFY)) {
    if (!needs.has(fix)) continue;
    if (wanted[key]) have[key] = wanted[key];
    else missing.push(key);
  }

  if (Object.keys(have).length) {
    const idx = pub && join(pub, 'index.html');
    if (fw.name === 'Static' && idx && existsSync(idx)) {
      let html = readFileSync(idx, 'utf8');
      const tags = Object.entries(have)
        .map(([k, v]) => gen.verifyMeta({ google: 'google-site-verification', naver: 'naver-site-verification', bing: 'msvalidate.01' }[k], v))
        .filter((t) => !html.includes(t));
      if (tags.length) plan.push({ path: idx, content: html.replace(/<head([^>]*)>/i, `<head$1>\n    ${tags.join('\n    ')}`), mode: 'merge', note: 'ownership tags' });
    } else {
      const sn = gen.verifySnippet(fw.name, have);
      snippets.push({ title: `Ownership verification — ${sn.how}`, body: sn.body });
    }
  }
  if (missing.length) {
    snippets.push({
      title: 'Ownership verification — tokens not provided yet',
      body: `Get the HTML-tag token from each console and re-run:\n  setup ${missing.map((k) => `--${k}-token=…`).join(' ')} --write`,
    });
  }

  if (needs.has('meta-og')) {
    snippets.push({
      title: 'Open Graph — add to <head>',
      body: gen.ogSnippet({ title: facts.home?.parsed?.title || '', description: facts.home?.parsed?.meta?.description || '', image: `${origin}/og.png` }),
    });
  }

  if (needs.has('llmstxt') && optIn('llmstxt')) {
    const pages = (facts.samples.length ? facts.samples : [facts.home]).filter((p) => p?.parsed).map((p) => ({ url: p.url, title: p.parsed.title }));
    const target = pub && join(pub, 'llms.txt');
    const content = gen.llmsTxt({ title: facts.home?.parsed?.title, origin, pages });
    if (target) plan.push({ path: target, content, mode: existsSync(target) ? 'replace' : 'create', note: 'optional' });
  }

  if (!plan.length && !snippets.length) {
    out('Nothing to autofix. Run todo to see what a human needs to do.');
    process.exit(EXIT.OK);
  }

  const rel = (p) => p.replace(root + '/', '');
  const L = [];

  if (!WRITE) {
    L.push('Preview only — no file changed. Apply with --write.', '');
    for (const p of plan) {
      const sign = p.mode === 'create' ? '+' : '~';
      L.push(`  ${sign} ${rel(p.path)}${p.note ? `   (${p.note})` : ''}`);
    }
    L.push('');
    for (const p of plan) {
      L.push(`──── ${rel(p.path)} ${'─'.repeat(Math.max(0, 50 - rel(p.path).length))}`);
      L.push(preview(p.content));
      L.push('');
    }
  } else {
    L.push('');
    for (const p of plan) {
      mkdirSync(dirname(p.path), { recursive: true });
      const existed = existsSync(p.path);
      if (existed) copyFileSync(p.path, p.path + '.bak');
      const before = existed ? readFileSync(p.path, 'utf8') : null;
      if (before === p.content) { L.push(`⏭ ${rel(p.path)}   unchanged (idempotent)`); continue; }
      writeFileSync(p.path, p.content);
      L.push(`✅ ${rel(p.path)}   ${existed ? `updated (backup: ${rel(p.path)}.bak)` : 'created'}`);
      if (p.config) saveConfig(p.config, root);
    }
  }

  for (const s of snippets) {
    L.push('', `⏭ ${s.title} — you need to add this yourself`, s.body.split('\n').map((x) => '   ' + x).join('\n'));
  }

  if (!WRITE) {
    L.push('', 'Apply: apply --write');
    L.push('Change policy: --ai-policy=open | cite-only | closed');
  } else if (facts.remote) {
    const re = await run(args);
    const c = re.result.counts;
    const changed = c.fail !== result.counts.fail || c.warn !== result.counts.warn;
    L.push('', `Re-scan of the deployed site: ❌${result.counts.fail} → ❌${c.fail} · ⚠️${result.counts.warn} → ⚠️${c.warn}`);
    if (!changed) L.push('The files just written take effect **after you deploy**. Deploy, then scan again.');
    if (c.fail || c.warn) L.push('Run todo for the work only a human can do.');
  }

  out(L.join('\n'));
  process.exit(EXIT.OK);
} catch (e) {
  log('execution error:', String(e?.stack || e));
  process.exit(EXIT.ERROR);
}

function preview(content, max = 24) {
  const lines = content.split('\n');
  if (lines.length <= max) return lines.map((l) => '  ' + l).join('\n');
  return [...lines.slice(0, max).map((l) => '  ' + l), `  … (${lines.length - max} more lines)`].join('\n');
}
