// Collection pipeline. Market detection splits in two phases (before and after fetching).
import { get, pool } from './http.mjs';
import { parseHtml } from './html.mjs';
import { parseSitemap, parseFeed } from './xml.mjs';
import { parseRobots } from './robots.mjs';
import { enginesPhase1, enginesPhase2 } from './engines.mjs';
import { log } from './args.mjs';

const FEED_PATHS = ['/rss', '/rss.xml', '/feed', '/feed.xml', '/atom.xml', '/index.xml'];
const SAMPLE_CAP = 10;      // design cap is 20; start conservative at 10
const LINK_CAP = 12;

const abs = (origin, p) => new URL(p, origin).toString();

export async function collect({ url, config = {}, options = {} }) {
  const facts = { baseUrl: url || null, engines: null, samples: [], feeds: [], files: {}, links: [], sitemaps: [] };

  const p1 = enginesPhase1({ option: options.engines, saved: config.engines, url: url || 'http://x.invalid' });
  facts.engines = p1;

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
  const sampleUrls = facts.sitemapEntries
    .map((e) => e.loc)
    .filter((u) => u && u !== homeRes.url)
    .slice(0, SAMPLE_CAP);
  if (sampleUrls.length) {
    log(`· fetching: ${sampleUrls.length} sample pages`);
    const res = await pool(sampleUrls, (u) => get(u));
    facts.samples = res.map((r) => ({ url: r.requested, res: r, parsed: r.body ? Object.assign(parseHtml(r.body), { url: r.url }) : null }));
    // Re-check engine signals across the samples too
    facts.engines = enginesPhase2(p1, [facts.home, ...facts.samples]);
  }

  // llms.txt and ownership verification files
  const [llms, bingFile] = await Promise.all([get(abs(origin, '/llms.txt')), get(abs(origin, '/BingSiteAuth.xml'))]);
  facts.llms = llms;
  facts.files['/BingSiteAuth.xml'] = bingFile;

  // IndexNow key: verifiable only when configured, since the filename *is* the key
  if (config.indexNow?.key) {
    const keyRes = await get(abs(origin, `/${config.indexNow.key}.txt`));
    facts.indexNowKey = { key: config.indexNow.key, res: keyRes };
  } else {
    facts.indexNowKey = null;
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

  return facts;
}
