// Framework adapters. When unsure we ask instead of writing (design principle).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const has = (root, p) => existsSync(join(root, p));

// A monorepo usually means several sites, each with its own domain and its own public/.
// Guessing one of them is worse than asking, so we list them and let intake ask.
const WORKSPACE_DIRS = ['apps', 'packages', 'sites', 'services'];

export function detectApps(root) {
  const globs = [];
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
    if (Array.isArray(ws)) globs.push(...ws);
  } catch {}
  try {
    const yml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
    for (const m of yml.matchAll(/^\s*-\s*['"]?([^'"\n]+)/gm)) globs.push(m[1].trim());
  } catch {}
  const parents = new Set();
  for (const g of globs) {
    const base = g.replace(/\/\*+$/, '');
    if (base && !base.includes('*')) parents.add(base);
  }
  if (!parents.size) for (const d of WORKSPACE_DIRS) if (has(root, d)) parents.add(d);

  const apps = [];
  for (const parent of parents) {
    let entries = [];
    try { entries = readdirSync(join(root, parent), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dir = join(root, parent, e.name);
      if (!has(dir, 'package.json')) continue;
      const fw = frameworkOf(dir);
      if (!fw.name) continue;
      // A shared library often depends on the framework too. A site has routes or a public dir.
      const isSite = fw.confident || ['app', 'pages', 'src/app', 'src/pages', 'src/routes'].some((r) => has(dir, r));
      if (!isSite) continue;
      apps.push({ dir, rel: `${parent}/${e.name}`, ...fw });
    }
  }
  return apps;
}

function frameworkOf(root) {
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); } catch {}
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps?.next) return adapter('Next.js', root, ['public'], deps);
  if (deps?.astro) return adapter('Astro', root, ['public'], deps);
  if (deps?.['@sveltejs/kit']) return adapter('SvelteKit', root, ['static'], deps);
  if (deps?.nuxt) return adapter('Nuxt', root, ['public'], deps);
  if (deps?.['react-scripts'] || deps?.vite) return adapter('Vite/SPA', root, ['public'], deps);
  if (has(root, 'index.html')) return adapter('Static', root, ['.'], deps);
  return { name: null, publicDir: null, confident: false, deps };
}

export function detectFramework(root) {
  const own = frameworkOf(root);
  if (own.name) return own;
  // No framework at the root: this is probably a monorepo. One app is unambiguous; several
  // is a question for intake, not a guess.
  const apps = detectApps(root);
  if (apps.length === 1) return { ...apps[0], fromWorkspace: apps[0].rel };
  if (apps.length > 1) return { name: null, publicDir: null, confident: false, deps: own.deps, apps };
  return own;
}

function adapter(name, root, candidates, deps) {
  const dir = candidates.find((c) => has(root, c));
  // Writing public/robots.txt is pointless when a generator rewrites it on every build.
  const robotsGen = robotsGenerator(root, deps);
  return {
    name, root, publicDir: dir, confident: !!dir, deps,
    // If a sitemap plugin already exists we only validate, never overwrite
    hasSitemapPlugin: !!(deps?.['next-sitemap'] || deps?.['@astrojs/sitemap'] || deps?.['nuxt-simple-sitemap'] || deps?.['svelte-sitemap']),
    robotsGeneratedBy: robotsGen,
    usesMetadataApi: name === 'Next.js' && (has(root, 'app') || has(root, 'src/app')),
  };
}

// Which tool owns robots.txt, if any?
function robotsGenerator(root, deps) {
  for (const f of ['next-sitemap.config.js', 'next-sitemap.config.mjs', 'next-sitemap.config.cjs', 'next-sitemap.config.ts']) {
    if (!has(root, f)) continue;
    let src = '';
    try { src = readFileSync(join(root, f), 'utf8'); } catch {}
    if (/generateRobotsTxt\s*:\s*true/.test(src)) return { tool: 'next-sitemap', file: f, shape: 'next-sitemap' };
  }
  if (deps?.['astro-robots-txt']) return { tool: 'astro-robots-txt', file: 'astro.config.*', shape: 'astro' };
  if (deps?.['nuxt-simple-robots'] || deps?.['@nuxtjs/robots']) return { tool: 'nuxt robots module', file: 'nuxt.config.*', shape: 'nuxt' };
  return null;
}

// Local route scan for sitemap generation. Returns an empty array rather than guessing.
export function scanRoutes(fw) {
  if (!fw?.root) return [];
  const out = new Set();
  const walk = (dir, base, test, depth = 0) => {
    if (depth > 8) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('_') || e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p, base, test, depth + 1); continue; }
      const route = test(p);
      if (route !== null) out.add(route);
    }
  };
  const rel = (p, root) => p.slice(root.length).replace(/\\/g, '/');

  if (fw.name === 'Next.js') {
    for (const appDir of ['app', 'src/app']) {
      const r = join(fw.root, appDir);
      if (!existsSync(r)) continue;
      walk(r, r, (p) => {
        if (!/[/\\]page\.(tsx|jsx|ts|js|mdx)$/.test(p)) return null;
        let route = rel(p, r).replace(/\/page\.[^/]+$/, '');
        route = route.replace(/\/\([^)]+\)/g, '');       // drop route groups
        if (/\[/.test(route)) return null;                // skip dynamic routes
        return route || '/';
      });
    }
    for (const pagesDir of ['pages', 'src/pages']) {
      const r = join(fw.root, pagesDir);
      if (!existsSync(r)) continue;
      walk(r, r, (p) => {
        if (!/\.(tsx|jsx|ts|js|mdx)$/.test(p) || /\/api\//.test(p)) return null;
        let route = rel(p, r).replace(/\.[^.]+$/, '').replace(/\/index$/, '');
        if (/\[/.test(route)) return null;
        return route || '/';
      });
    }
  } else if (fw.name === 'Astro' || fw.name === 'SvelteKit' || fw.name === 'Nuxt') {
    const dirs = fw.name === 'SvelteKit' ? ['src/routes'] : ['src/pages', 'pages'];
    for (const d of dirs) {
      const r = join(fw.root, d);
      if (!existsSync(r)) continue;
      walk(r, r, (p) => {
        const isPage = fw.name === 'SvelteKit' ? /\+page\.(svelte|md)$/.test(p) : /\.(astro|md|mdx|vue)$/.test(p);
        if (!isPage) return null;
        let route = rel(p, r).replace(/\/\+page\.[^/]+$/, '').replace(/\.(astro|md|mdx|vue)$/, '').replace(/\/index$/, '');
        route = route.replace(/\/\([^)]+\)/g, '');
        if (/\[/.test(route)) return null;
        return route || '/';
      });
    }
  } else if (fw.name === 'Static') {
    walk(fw.root, fw.root, (p) => {
      if (!/\.html$/.test(p)) return null;
      return rel(p, fw.root).replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
    });
  }
  return [...out].sort();
}
