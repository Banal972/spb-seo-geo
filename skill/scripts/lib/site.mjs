// Find the site URL and an access log without asking. Anything inferable must not be a
// question — the user already told us, just in a config file instead of a sentence.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const clean = (u) => {
  if (!u) return null;
  let v = String(u).trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
  if (!v || v.includes('${') || /localhost|127\.0\.0\.1|example\.(com|org)/.test(v)) return null;
  if (!/^https?:\/\//.test(v)) { if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return null; v = 'https://' + v; }
  try { new URL(v); return v; } catch { return null; }
};

const ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_URL', 'SITE_URL', 'PUBLIC_SITE_URL',
  'NUXT_PUBLIC_SITE_URL', 'URL', 'DEPLOY_PRIME_URL', 'VITE_SITE_URL', 'PUBLIC_URL',
];

// Ordered by how much the source actually means it.
export function detectSiteUrl(root) {
  const tried = [];
  const hit = (url, where) => { const c = clean(url); if (c) { tried.push({ url: c, where }); } };

  // 1. An explicit site field in a framework config is a declaration, not a guess.
  for (const f of ['astro.config.mjs', 'astro.config.ts', 'astro.config.js', 'nuxt.config.ts', 'nuxt.config.js', 'svelte.config.js', 'next.config.js', 'next.config.mjs', 'next.config.ts', 'gatsby-config.js', 'docusaurus.config.js']) {
    const src = read(join(root, f));
    if (!src) continue;
    const m = /\b(?:site|siteUrl|url)\s*:\s*['"`]([^'"`]+)['"`]/.exec(src);
    if (m) hit(m[1], f);
  }
  // 2. next-sitemap and friends
  for (const f of ['next-sitemap.config.js', 'next-sitemap.config.mjs', 'sitemap.config.js']) {
    const m = /siteUrl\s*:\s*['"`]([^'"`]+)['"`]/.exec(read(join(root, f)));
    if (m) hit(m[1], f);
  }
  // 3. package.json homepage
  try {
    const pkg = JSON.parse(read(join(root, 'package.json')) || '{}');
    if (pkg.homepage) hit(pkg.homepage, 'package.json homepage');
  } catch {}
  // 4. A custom domain file is as explicit as it gets
  for (const f of ['public/CNAME', 'CNAME', 'static/CNAME', 'docs/CNAME']) {
    const v = read(join(root, f)).trim().split('\n')[0];
    if (v) hit(v, f);
  }
  // 5. Environment files
  for (const f of ['.env.production', '.env.local', '.env', '.env.example']) {
    const src = read(join(root, f));
    if (!src) continue;
    for (const line of src.split('\n')) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+)$/.exec(line);
      if (m && ENV_KEYS.includes(m[1])) hit(m[2].split('#')[0], `${f} (${m[1]})`);
    }
  }
  // 6. An already-written sitemap tells us the canonical host
  for (const f of ['public/sitemap.xml', 'static/sitemap.xml', 'sitemap.xml']) {
    const m = /<loc>\s*(https?:\/\/[^<\s\/]+)/.exec(read(join(root, f)));
    if (m) hit(m[1], f);
  }
  // 7. robots.txt Sitemap: line
  for (const f of ['public/robots.txt', 'static/robots.txt', 'robots.txt']) {
    const m = /Sitemap:\s*(https?:\/\/[^\s\/]+)/i.exec(read(join(root, f)));
    if (m) hit(m[1], f);
  }

  if (!tried.length) return { url: null, where: null, candidates: [] };
  // Several sources agreeing is the strongest case; otherwise take the most explicit one.
  const counts = new Map();
  for (const t of tried) counts.set(t.url, (counts.get(t.url) || 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const where = tried.filter((t) => t.url === best).map((t) => t.where);
  return { url: best, where: where.join(', '), candidates: [...counts.keys()] };
}

const LOG_PATHS = ['access.log', 'logs/access.log', 'log/access.log', 'var/log/access.log', 'access_log', 'logs/nginx-access.log'];

export function detectAccessLog(root) {
  for (const p of LOG_PATHS) if (existsSync(join(root, p))) return join(root, p);
  try {
    const f = readdirSync(root).find((n) => /access.*\.log(\.gz)?$/i.test(n));
    if (f) return join(root, f);
  } catch {}
  return null;
}
