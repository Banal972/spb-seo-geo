#!/usr/bin/env node
// IndexNow batch submission. Google does not participate, so never pretend we notified it.
import { parseArgs, out, log, EXIT } from './lib/args.mjs';
import { findRoot, loadConfig } from './lib/config.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINTS = [
  { name: 'api.indexnow.org', url: 'https://api.indexnow.org/indexnow', note: 'shared with Bing · Yandex · Seznam' },
  { name: 'searchadvisor.naver.com', url: 'https://searchadvisor.naver.com/indexnow', note: 'Naver' },
];
const BATCH = 10000;
const DEDUPE_HOURS = 24;

const args = parseArgs();
const root = args.dir ? String(args.dir) : findRoot();
const config = loadConfig(root);
const site = String(args.url || config.url || '');

if (!site) { out('A deployed address is required: submit --url https://example.com'); process.exit(EXIT.ERROR); }
const key = config.indexNow?.key;
if (!key) {
  out(['No IndexNow key found.', 'Run apply --write first to create the key file.'].join('\n'));
  process.exit(EXIT.ERROR);
}

const origin = new URL(site).origin;
const host = new URL(site).host;

let urls = [];
if (args.urls) urls = String(args.urls).split(',').map((s) => s.trim()).filter(Boolean);
else if (args.since) urls = fromGit(String(args.since));
if (!urls.length) { out('No URLs to submit. Pass --urls a,b or --since HEAD~1.'); process.exit(EXIT.OK); }
urls = urls.map((u) => (u.startsWith('http') ? u : new URL(u, origin).toString()));

// Skip URLs resubmitted within 24h: Naver prefers organic crawling over forced requests
const statePath = join(root, '.spb-seo-geo', 'submitted.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
const now = Date.now();
const skipped = urls.filter((u) => state[u] && now - state[u] < DEDUPE_HOURS * 3600e3);
const fresh = urls.filter((u) => !skipped.includes(u));

const L = [`${urls.length} changed URLs${skipped.length ? ` (${skipped.length} skipped — already submitted within 24h)` : ''}`, ''];

if (!fresh.length) {
  L.push('Nothing new to send.');
  out(L.join('\n'));
  process.exit(EXIT.OK);
}

for (const ep of ENDPOINTS) {
  const results = [];
  for (let i = 0; i < fresh.length; i += BATCH) {
    const chunk = fresh.slice(i, i + BATCH);
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: chunk }),
      });
      results.push(`${res.status}`);
    } catch (e) { results.push(`failed(${String(e?.message || e).slice(0, 40)})`); }
  }
  L.push(`  ${ep.name.padEnd(26)} ${results.join(',')}  ${fresh.length} URLs sent (${ep.note})`);
}

if (!args['dry-run']) {
  mkdirSync(join(root, '.spb-seo-geo'), { recursive: true });
  for (const u of fresh) state[u] = now;
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

L.push('', 'Google does not participate in IndexNow. Google discovers pages via your sitemap and internal links.');
out(L.join('\n'));
process.exit(EXIT.OK);

function fromGit(ref) {
  try {
    const diff = execSync(`git diff --name-only ${ref} HEAD`, { cwd: root, encoding: 'utf8' });
    const files = diff.split('\n').filter(Boolean);
    const routes = new Set();
    for (const f of files) {
      const m = /(?:^|\/)(?:app|pages|src\/pages|src\/routes|content)\/(.+)$/.exec(f);
      if (!m) continue;
      let r = '/' + m[1]
        .replace(/\/(page|index|\+page)\.[^/]+$/, '')
        .replace(/\.(md|mdx|astro|html|tsx|jsx|ts|js|svelte|vue)$/, '')
        .replace(/\/\([^)]+\)/g, '');
      if (/\[/.test(r)) continue;
      routes.add(r === '/index' ? '/' : r);
    }
    return [...routes];
  } catch (e) { log('git diff failed:', String(e?.message || e)); return []; }
}
