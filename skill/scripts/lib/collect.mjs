// Collection pipeline. Market detection splits in two phases (before and after fetching).
import { get, pool } from './http.mjs';
import { parseHtml } from './html.mjs';
import { parseSitemap, parseFeed } from './xml.mjs';
import { parseRobots } from './robots.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enginesPhase1, enginesPhase2 } from './engines.mjs';
import { analyze } from './accesslog.mjs';
import { log } from './args.mjs';

const FEED_PATHS = ['/rss', '/rss.xml', '/feed', '/feed.xml', '/atom.xml', '/index.xml'];
const SAMPLE_CAP = 10;      // design cap is 20; start conservative at 10
const LINK_CAP = 12;

const abs = (origin, p) => new URL(p, origin).toString();

export async function collect({ url, config = {}, options = {} }) {
  const facts = { baseUrl: url || null, engines: null, samples: [], feeds: [], files: {}, links: [], sitemaps: [] };

  const p1 = enginesPhase1({ option: options.engines, saved: config.engines, url: url || 'http://x.invalid' });
  facts.engines = p1;

  // Access log first: it works with or without a URL, and it is the only deterministic
  // evidence of whether AI crawlers actually reach the site.
  if (options.accessLog) {
    log('· reading access log');
    facts.accessLog = analyze(String(options.accessLog), { window: Number(options.logWindow) || 30 });
    if (!facts.accessLog.ok) log('! access log: ' + facts.accessLog.error);
  }

  if (!url) { facts.remote = false; return facts; }
  facts.remote = true;
  const origin = new URL(url).origin;
  facts.origin = origin;

  log('· fetching: robots.txt and home');
  const [robotsRes, homeRes] = await Promise.all([get(abs(origin, '/robots.txt')), get(url)]);
  facts.robots = { res: robotsRes, parsed: parseRobots(robotsRes.ok ? robotsRes.body : '') };
  facts.home = { res: homeRes, url: homeRes.url, parsed: homeRes.body ? parseHtml(homeRes.body) : null };
  if (facts.home.parsed) facts.home.parsed.url = homeRes.url;

  // Phase 2 detection: HTML signals such as naver-site-verification and Hangul ratio
  facts.engines = enginesPhase2(p1, [facts.home]);

  // Sitemap: prefer what robots.txt declares, fall back to conventional paths
  const declared = facts.robots.parsed.sitemaps;
  const candidates = declared.length ? declared : [abs(origin, '/sitemap.xml'), abs(origin, '/sitemap_index.xml')];
  facts.sitemapDeclared = declared.length > 0;

  for (const sm of candidates.slice(0, 3)) {
    const res = await get(sm);
    if (!res.ok) { facts.sitemaps.push({ url: sm, res, parsed: null }); continue; }
    const parsed = parseSitemap(res.body);
    facts.sitemaps.push({ url: sm, res, parsed });
    if (parsed.isIndex) {
      const children = await pool(parsed.entries.slice(0, 2).map((e) => e.loc), (u) => get(u));
      for (const c of children) {
        if (c.ok) facts.sitemaps.push({ url: c.requested, res: c, parsed: parseSitemap(c.body), child: true });
      }
    }
    if (declared.length) break;
  }

  facts.sitemapEntries = facts.sitemaps.flatMap((s) => (s.parsed?.entries || []));

  // Sample pages
  // A sitemap can list other sitemaps, feeds or assets. Parsing those as HTML produced a
  // cascade of false failures (no title, no canonical, broken headings) on real sites.
  const looksLikePage = (u) => !/\.(xml|json|txt|rss|atom|pdf|png|jpe?g|webp|svg|gz|csv|ico)(\?|$)/i.test(u);
  const sampleUrls = facts.sitemapEntries
    .map((e) => e.loc)
    .filter((u) => u && u !== homeRes.url && looksLikePage(u))
    .slice(0, SAMPLE_CAP);
  if (sampleUrls.length) {
    log(`· fetching: ${sampleUrls.length} sample pages`);
    const res = await pool(sampleUrls, (u) => get(u));
    // Trust the served content type over the URL shape — the real guard.
    facts.samples = res.map((r) => {
      const isHtml = /text\/html|application\/xhtml/i.test(r.contentType || '');
      return {
        url: r.requested, res: r, notHtml: !isHtml && r.ok,
        parsed: r.body && isHtml ? Object.assign(parseHtml(r.body), { url: r.url }) : null,
      };
    });
    const skippedNonHtml = facts.samples.filter((x) => x.notHtml).length;
    if (skippedNonHtml) log(`· ${skippedNonHtml} sampled URLs were not HTML — excluded from page checks`);
    // Re-check engine signals across the samples too
    facts.engines = enginesPhase2(p1, [facts.home, ...facts.samples]);
  }

  // llms.txt and ownership verification files
  const [llms, bingFile] = await Promise.all([get(abs(origin, '/llms.txt')), get(abs(origin, '/BingSiteAuth.xml'))]);
  facts.llms = llms;
  facts.files['/BingSiteAuth.xml'] = bingFile;

  // The IndexNow filename *is* the key, so a key file in the repo tells us what to probe.
  // Configured value wins; otherwise try what is committed.
  const keyCandidates = [
    config.indexNow?.key,
    ...(options.local?.indexNowKeys || []).map((p) => p.split('/').pop().replace(/\.txt$/i, '')),
  ].filter(Boolean);
  facts.indexNowKey = null;
  for (const key of [...new Set(keyCandidates)]) {
    const keyRes = await get(abs(origin, `/${key}.txt`));
    facts.indexNowKey = { key, res: keyRes, fromRepo: key !== config.indexNow?.key };
    if (keyRes.ok) break;
  }

  // RSS: probe only when market=kr, so a global site never fires these requests
  const declaredFeeds = (facts.home.parsed?.feeds || []).map((f) => abs(homeRes.url, f));
  if (declaredFeeds.length) {
    const res = await pool(declaredFeeds.slice(0, 2), (u) => get(u));
    facts.feeds = res.map((r) => ({ url: r.requested, res: r, parsed: r.ok ? parseFeed(r.body) : null, declared: true }));
  } else if (!facts.engines.answered || facts.engines.engines.includes('naver')) {
    log('· probing conventional RSS paths (Naver still uses RSS)');
    const res = await pool(FEED_PATHS.map((p) => abs(origin, p)), (u) => get(u));
    facts.feeds = res.filter((r) => r.ok).map((r) => ({ url: r.requested, res: r, parsed: parseFeed(r.body), declared: false }));
  }

  // Every internal link we saw anywhere, for reachability. A dynamic home page changes its
  // links between requests, so one page alone made the orphan check flap.
  facts.linkedUrls = new Set();
  for (const p of [facts.home, ...facts.samples]) {
    for (const a of p?.parsed?.anchors || []) {
      if (!a.href) continue;
      try {
        const u = new URL(a.href, p.url).toString().replace(/#.*$/, '').replace(/\/$/, '');
        if (u.startsWith(origin)) facts.linkedUrls.add(u);
      } catch {}
    }
  }

  // Health of internal links leaving the home page
  const internal = [...new Set((facts.home.parsed?.anchors || [])
    .map((a) => a.href)
    .filter(Boolean)
    .map((h) => { try { return new URL(h, homeRes.url).toString(); } catch { return null; } })
    .filter((u) => u && u.startsWith(origin) && !u.includes('#')))].slice(0, LINK_CAP);
  if (internal.length) {
    const res = await pool(internal, (u) => get(u, { method: 'HEAD', timeout: 5000 }));
    facts.links = res.map((r) => ({ url: r.requested, status: r.status, ok: r.ok }));
  }

  // "I already fixed that" usually means the repo is ahead of the deployment. Saying so
  // costs one line and saves the whole confusion.
  facts.deployLag = [];
  for (const [rel, path] of [[options.local?.robots, '/robots.txt'], [options.local?.sitemap, '/sitemap.xml']]) {
    if (!rel) continue;
    try {
      const localBody = readFileSync(join(options.root || '.', rel), 'utf8').trim();
      const liveRes = path === '/robots.txt' ? facts.robots?.res : facts.sitemaps.find((x) => x.url.endsWith(path))?.res;
      if (!liveRes?.ok) continue;
      if (liveRes.body.trim() !== localBody) facts.deployLag.push(rel);
    } catch {}
  }

  return facts;
}

// What already exists in the project? A file that is committed but not yet deployed is a
// different problem from a file that was never created, and the advice differs.
export function collectLocalFiles(root, fw) {
  const dirs = [fw?.publicDir, 'public', 'static', '.'].filter(Boolean);
  const found = { verify: [], robots: null, sitemap: null, rss: null, llms: null, indexNowKeys: [] };
  for (const d of dirs) {
    const dir = join(root, d);
    let entries = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      const rel = d === '.' ? name : `${d}/${name}`;
      if (/^robots\.txt$/i.test(name)) found.robots ||= rel;
      else if (/^sitemap.*\.xml$/i.test(name)) found.sitemap ||= rel;
      else if (/^(rss|feed|atom|index)\.xml$/i.test(name)) found.rss ||= rel;
      else if (/^llms\.txt$/i.test(name)) found.llms ||= rel;
      else if (/^(naver[a-z0-9]*\.html|google[a-z0-9]*\.html|BingSiteAuth\.xml|yandex_[a-z0-9]*\.html)$/i.test(name)) found.verify.push(rel);
      else if (/^[0-9a-f]{16,64}\.txt$/i.test(name)) found.indexNowKeys.push(rel);
    }
    if (found.robots || found.verify.length) break;
  }
  return found;
}
