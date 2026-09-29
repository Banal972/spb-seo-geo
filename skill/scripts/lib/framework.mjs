// Framework adapters. When unsure we ask instead of writing (design principle).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const has = (root, p) => existsSync(join(root, p));

export function detectFramework(root) {
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

function adapter(name, root, candidates, deps) {
  const dir = candidates.find((c) => has(root, c));
  return {
    name, root, publicDir: dir, confident: !!dir, deps,
    // If a sitemap plugin already exists we only validate, never overwrite
    hasSitemapPlugin: !!(deps?.['next-sitemap'] || deps?.['@astrojs/sitemap'] || deps?.['nuxt-simple-sitemap'] || deps?.['svelte-sitemap']),
    usesMetadataApi: name === 'Next.js' && (has(root, 'app') || has(root, 'src/app')),
  };
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
