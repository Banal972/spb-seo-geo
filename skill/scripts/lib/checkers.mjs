// Declarative checker registry.
// Contract: (facts, args, rule) => { ok: true|false|null, detail?: string }
//   ok=null means "could not check". It is never promoted to true (invariant 2).
import { isAllowed, blocksEverything, hasExplicitGroup } from './robots.mjs';
import { isValidLastmod } from './xml.mjs';
import { scriptRatios, citationSignals as sig } from './html.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const UNKNOWN = (why) => ({ ok: null, detail: why });
const needRemote = (f) => (f.remote ? null : UNKNOWN('ran without a deployed URL (--url required)'));
const pages = (f) => [f.home, ...f.samples].filter((p) => p && p.parsed);

export const checkers = {
  urlOk(f, a) {
    const g = needRemote(f); if (g) return g;
    const res = a.path === '/robots.txt' ? f.robots?.res : f.files[a.path];
    if (!res) return UNKNOWN('not fetched');
    if (!res.ok) return { ok: false, detail: res.error ? `request failed: ${res.error}` : `HTTP ${res.status}` };
    if (a.notHtml && /text\/html/i.test(res.contentType)) {
      return { ok: false, detail: `returns HTML (${res.contentType}) — crawlers cannot parse it` };
    }
    return { ok: true, detail: `HTTP ${res.status}` };
  },

  robotsNotBlockingAll(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.robots?.res?.ok) return UNKNOWN('could not read robots.txt');
    if (blocksEverything(f.robots.parsed, '*')) return { ok: false, detail: 'User-agent: * has Disallow: /' };
    return { ok: true };
  },

  robotsAllows(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.robots?.res?.ok) return { ok: true, detail: 'no robots.txt means everything is allowed' };
    const blocked = [];
    for (const ua of a.uas) {
      const r = isAllowed(f.robots.parsed, ua, '/');
      if (!r.allowed) blocked.push(`${ua} (${r.by.type}: ${r.by.path})`);
    }
    if (blocked.length) return { ok: false, detail: `blocked — ${blocked.join(', ')}` };
    return { ok: true, detail: `${a.uas.join(' · ')} allowed` };
  },

  trainingPolicy(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.robots?.res?.ok) return { ok: true, detail: 'no robots.txt, so all training bots are allowed (same as ai-policy=open)' };
    const blocked = a.uas.filter((ua) => !isAllowed(f.robots.parsed, ua, '/').allowed);
    const want = f.aiPolicy || 'open';
    const okState = want === 'open' ? blocked.length === 0 : blocked.length === a.uas.length;
    return {
      ok: okState,
      detail: `${blocked.length}/${a.uas.length} training bots blocked · current preset ${want}` +
        (blocked.length ? ` (${blocked.join(', ')})` : ''),
    };
  },

  botPolicyInfo(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.robots?.res?.ok) return { ok: true, detail: `${a.ua} unrestricted` };
    const explicit = hasExplicitGroup(f.robots.parsed, a.ua);
    const allowed = isAllowed(f.robots.parsed, a.ua, '/').allowed;
    return { ok: true, detail: explicit ? `${a.ua} has an explicit rule · ${allowed ? 'allowed' : 'blocked'}` : `${a.ua} not mentioned (allowed)` };
  },

  sitemapDeclared(f) {
    const g = needRemote(f); if (g) return g;
    const found = f.sitemaps.find((s) => s.parsed?.valid);
    if (!found) return { ok: false, detail: 'no valid sitemap found' };
    if (!f.sitemapDeclared) return { ok: false, detail: `${found.url} exists but robots.txt has no Sitemap: line` };
    return { ok: true, detail: `${f.sitemapEntries.length} URLs · declared in robots.txt` };
  },

  sitemapLimits(f, a) {
    const g = needRemote(f); if (g) return g;
    const files = f.sitemaps.filter((s) => s.parsed?.valid && !s.parsed.isIndex);
    if (!files.length) return UNKNOWN('no sitemap');
    const over = files.filter((s) => s.parsed.entries.length > a.maxUrls || s.res.bytes > a.maxBytes);
    if (over.length) return { ok: false, detail: over.map((s) => `${s.url} (${s.parsed.entries.length} URLs / ${Math.round(s.res.bytes / 1048576)}MB)`).join(', ') };
    return { ok: true, detail: `largest ${Math.max(...files.map((s) => s.parsed.entries.length))} URLs` };
  },

  sitemapAbsoluteSameHost(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.sitemapEntries?.length) return UNKNOWN('no sitemap');
    const host = new URL(f.origin).host;
    const bad = f.sitemapEntries.filter((e) => {
      if (!/^https?:\/\//i.test(e.loc)) return true;
      try { return new URL(e.loc).host !== host; } catch { return true; }
    });
    if (bad.length) return { ok: false, detail: `${bad.length} entries — e.g. ${bad[0].loc}` };
    return { ok: true };
  },

  sitemapSampleHealthy(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.samples.length) return UNKNOWN('no URLs to sample');
    const bad = [];
    for (const s of f.samples) {
      if (!s.res.ok) bad.push(`${s.url} → HTTP ${s.res.status}`);
      else if (s.res.redirects.length) bad.push(`${s.url} → redirect`);
      else if (/noindex/.test(s.parsed?.robotsMeta || '')) bad.push(`${s.url} → noindex`);
    }
    if (bad.length) return { ok: false, detail: `${bad.length}/${f.samples.length} bad — e.g. ${bad[0]}` };
    return { ok: true, detail: `${f.samples.length} sampled URLs healthy` };
  },

  sitemapLastmod(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.sitemapEntries?.length) return UNKNOWN('no sitemap');
    const bad = f.sitemapEntries.filter((e) => !isValidLastmod(e.lastmod));
    if (bad.length) return { ok: false, detail: `${bad.length}/${f.sitemapEntries.length} entries lack a valid lastmod` };
    return { ok: true };
  },

  homeRedirectChain(f, a) {
    const g = needRemote(f); if (g) return g;
    const res = f.home.res;
    if (!res.ok) return { ok: false, detail: `home returned HTTP ${res.status}${res.error ? ` (${res.error})` : ''}` };
    if (res.redirects.length > a.max) return { ok: false, detail: `${res.redirects.length} redirects` };
    return { ok: true, detail: res.redirects.length ? `${res.redirects.length} redirect` : 'direct 200' };
  },

  canonicalSelf(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const bad = list.filter((p) => {
      if (!p.parsed.canonical) return true;
      try { return new URL(p.parsed.canonical, p.url).toString().replace(/\/$/, '') !== p.url.replace(/\/$/, ''); }
      catch { return true; }
    });
    if (bad.length) return { ok: false, detail: `${bad.length}/${list.length} pages — e.g. ${bad[0].url} (${bad[0].parsed.canonical || 'no canonical'})` };
    return { ok: true };
  },

  titleDescription(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const missing = list.filter((p) => !p.parsed.title || !p.parsed.meta['description']);
    const titles = list.map((p) => p.parsed.title).filter(Boolean);
    const dup = titles.length - new Set(titles).size;
    if (missing.length) return { ok: false, detail: `${missing.length} pages missing a title or description` };
    if (dup > 0) return { ok: false, detail: `${dup} duplicate titles` };
    return { ok: true, detail: `${list.length} pages unique` };
  },

  llmsTxt(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.llms) return UNKNOWN('not checked');
    if (f.llms.error) return UNKNOWN(`request failed: ${f.llms.error}`);
    return { ok: f.llms.ok, detail: f.llms.ok ? 'present' : 'absent (optional)' };
  },

  textRendered(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.home.parsed) return UNKNOWN('could not read the HTML');
    const len = f.home.parsed.textLen;
    return { ok: len >= a.minChars, detail: `${len} chars of body text in the initial HTML` };
  },

  internalLinksOk(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.links.length) return UNKNOWN('no internal links to check');
    const bad = f.links.filter((l) => l.status >= 400 || l.status === 0);
    if (bad.length) return { ok: false, detail: `${bad.length}/${f.links.length} broken — e.g. ${bad[0].url} (${bad[0].status || 'connection failed'})` };
    return { ok: true, detail: `${f.links.length} links healthy` };
  },

  langMatchesContent(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.home.parsed) return UNKNOWN('could not read the HTML');
    const { lang, text } = f.home.parsed;
    if (!lang) return { ok: false, detail: 'no lang attribute on <html>' };
    if (text.length < 200) return UNKNOWN('body text too short to judge language');
    const r = scriptRatios(text);
    // Only scripts we can identify reliably are checked: Hangul for Korean, kana for Japanese.
    const pct = (x) => `${Math.round(x * 100)}%`;
    if (r.hangul >= 0.3 && !/^ko/.test(lang)) return { ok: false, detail: `${pct(r.hangul)} Hangul body but lang=${lang}` };
    if (r.kana >= 0.1 && !/^ja/.test(lang)) return { ok: false, detail: `${pct(r.kana)} kana body but lang=${lang}` };
    if (/^ko/.test(lang) && r.hangul < 0.05) return { ok: false, detail: `lang=${lang} but only ${pct(r.hangul)} Hangul` };
    if (/^ja/.test(lang) && r.kana < 0.02) return { ok: false, detail: `lang=${lang} but only ${pct(r.kana)} kana` };
    const seen = r.hangul >= 0.05 ? `${pct(r.hangul)} Hangul` : r.kana >= 0.02 ? `${pct(r.kana)} kana` : 'latin/other script';
    return { ok: true, detail: `lang=${lang} · ${seen}` };
  },

  metaPresent(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.home.parsed) return UNKNOWN('could not read the HTML');
    const h = f.home.parsed;
    const missing = [];
    for (const n of a.names || []) if (!h.meta[n]) missing.push(n);
    for (const p of a.properties || []) if (!h.property[p]) missing.push(p);
    if (!missing.length) return { ok: true };
    for (const p of a.orPaths || []) {
      const res = f.files[p];
      if (res?.ok) return { ok: true, detail: `verified via ${p}` };
    }
    if (a.unknownIfMissing) return UNKNOWN(`${missing.join(', ')} absent — ${a.reason || 'another verification method may have been used'}`);
    return { ok: false, detail: `missing: ${missing.join(', ')}` };
  },

  indexNowKey(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.indexNowKey) return { ok: false, detail: 'no key configured (.spb-seo-geo.json)' };
    const { key, res } = f.indexNowKey;
    if (!res.ok) return { ok: false, detail: `/${key}.txt returned HTTP ${res.status}` };
    if (res.body.trim() !== key) return { ok: false, detail: `/${key}.txt content does not match the key` };
    return { ok: true, detail: `/${key}.txt verified` };
  },

  noindexAbsent(f) {
    const g = needRemote(f); if (g) return g;
    const hits = [];
    for (const p of pages(f)) {
      if (/noindex/.test(p.parsed.robotsMeta)) hits.push(`${p.url} (meta)`);
      const hdr = (p.res.headers['x-robots-tag'] || '').toLowerCase();
      if (hdr.includes('noindex')) hits.push(`${p.url} (X-Robots-Tag)`);
    }
    if (!pages(f).length) return UNKNOWN('could not read the HTML');
    if (hits.length) return { ok: false, detail: hits.join(', ') };
    return { ok: true };
  },

  snippetControlsAbsent(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const hits = [];
    for (const p of list) {
      const m = p.parsed.robotsMeta;
      const hdr = (p.res.headers['x-robots-tag'] || '').toLowerCase();
      const all = m + ',' + hdr;
      if (/nosnippet/.test(all)) hits.push(`${p.url} — nosnippet`);
      const ms = /max-snippet\s*:\s*(-?\d+)/.exec(all);
      if (ms && Number(ms[1]) === 0) hits.push(`${p.url} — max-snippet:0`);
      if (p.parsed.hasDataNosnippet) hits.push(`${p.url} — uses data-nosnippet`);
    }
    if (hits.length) return { ok: false, detail: hits.slice(0, 3).join(' · ') };
    return { ok: true, detail: 'no snippet restrictions (AI citation eligibility intact)' };
  },

  jsonLdValid(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    const blocks = list.flatMap((p) => p.parsed.jsonLd.map((b) => ({ b, url: p.url })));
    if (!blocks.length) return UNKNOWN('no JSON-LD present (not required for AI surfaces)');
    const bad = [];
    for (const { b, url } of blocks) {
      try { JSON.parse(b); } catch (e) { bad.push(`${url}: ${String(e.message).slice(0, 60)}`); }
    }
    if (bad.length) return { ok: false, detail: bad[0] };
    return { ok: true, detail: `${blocks.length} blocks parse cleanly` };
  },

  localGrep(f, a) {
    if (!f.dir) return UNKNOWN('no local project path (--dir)');
    const re = new RegExp(a.pattern);
    const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.astro', '.svelte-kit', 'coverage']);
    const exts = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.py', '.rb', '.go', '.php', '.yml', '.yaml']);
    const hits = [];
    const walk = (dir, depth = 0) => {
      if (depth > 6 || hits.length) return;
      let entries = [];
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (hits.length) return;
        if (e.name.startsWith('.') && e.name !== '.github') continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (!skip.has(e.name)) walk(p, depth + 1); continue; }
        if (!exts.has(extname(e.name))) continue;
        try {
          if (statSync(p).size > 512000) continue;
          if (re.test(readFileSync(p, 'utf8'))) hits.push(p);
        } catch {}
      }
    };
    walk(f.dir);
    if (hits.length) return { ok: false, detail: `found in ${hits[0]}` };
    return { ok: true, detail: 'no such usage' };
  },

  manual(f, a) {
    return { ok: null, detail: 'there is no way to check this from outside', todo: a.todo || [] };
  },

  rssPresent(f) {
    const g = needRemote(f); if (g) return g;
    const good = f.feeds.filter((x) => x.parsed?.valid && x.parsed.items.length > 0);
    if (!good.length) return { ok: false, detail: f.feeds.length ? 'found a feed but it has no valid items' : 'no feed found' };
    const first = good[0];
    return { ok: true, detail: `${first.url} · ${first.parsed.items.length} items${first.declared ? ' (declared in head)' : ''}` };
  },

  textNotBuriedInImages(f, a) {
    const g = needRemote(f); if (g) return g;
    if (!f.home.parsed) return UNKNOWN('could not read the HTML');
    const { textLen, imgs } = f.home.parsed;
    if (imgs === 0) return { ok: true, detail: 'no images' };
    const per = textLen / imgs;
    return { ok: per >= a.minTextPerImage, detail: `${textLen} chars / ${imgs} images = ${Math.round(per)} chars per image` };
  },

  orphanPages(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.sitemapEntries?.length || !f.links.length) return UNKNOWN('no sitemap or internal links to compare');
    const linked = new Set(f.links.map((l) => l.url.replace(/\/$/, '')));
    linked.add(f.home.url.replace(/\/$/, ''));
    const orphans = f.sitemapEntries
      .map((e) => e.loc.replace(/\/$/, ''))
      .filter((u) => !linked.has(u));
    // We only walked links from the home page, so deep pages may not truly be orphans -> flag only at an extreme ratio
    const ratio = orphans.length / f.sitemapEntries.length;
    if (ratio > 0.9 && f.sitemapEntries.length > 3) {
      return { ok: false, detail: `${orphans.length} of ${f.sitemapEntries.length} sitemap URLs are unreachable from the home page` };
    }
    return { ok: true, detail: `${f.sitemapEntries.length - orphans.length}/${f.sitemapEntries.length} reachable from home` };
  },

  citationSignals(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    let n = 0, q = 0, e = 0;
    for (const p of list) { const s = sig(p.parsed); n += s.numbers; q += s.quotes; e += s.external; }
    const ok = n >= 3 || q >= 1 || e >= 2;
    return { ok, detail: `${n} statistics · ${q} quotations · ${e} outbound sources (across ${list.length} pages)` };
  },

  structuredElements(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const total = list.reduce((a, p) => a + p.parsed.lists, 0);
    return { ok: total > 0, detail: `${total} lists or tables` };
  },
};
