// Declarative checker registry.
// Contract: (facts, args, rule) => { ok: true|false|null, detail?: string }
//   ok=null means "could not check". It is never promoted to true (invariant 2).
import { isAllowed, blocksEverything, hasExplicitGroup, contradictoryGroups } from './robots.mjs';
import { AI_BOTS } from './generate.mjs';
import { isValidLastmod } from './xml.mjs';
import { scriptRatios, citationSignals as sig } from './html.mjs';
import { BOT_FAMILIES } from './accesslog.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const UNKNOWN = (why) => ({ ok: null, detail: why });
const needRemote = (f) => {
  if (!f.remote) return UNKNOWN('ran without a deployed URL (--url required)');
  // Nothing about the live site is knowable if we never reached it.
  if (f.unreachable) return UNKNOWN(`the site could not be reached (${f.unreachable})`);
  return null;
};
const pages = (f) => [f.home, ...f.samples].filter((p) => p && p.parsed);

export const checkers = {
  urlOk(f, a) {
    const g = needRemote(f); if (g) return g;
    const res = a.path === '/robots.txt' ? f.robots?.res : f.files[a.path];
    if (!res) return UNKNOWN('not fetched');
    if (!res.ok) {
      const localHint = a.path === '/robots.txt' && f.local?.robots ? ` — ${f.local.robots} exists locally but is not live yet` : '';
      return { ok: false, detail: (res.error ? `request failed: ${res.error}` : `HTTP ${res.status}`) + localHint };
    }
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

  titlePresent(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const missing = list.filter((p) => !p.parsed.title);
    if (missing.length) return { ok: false, detail: `${missing.length}/${list.length} pages have no title — e.g. ${missing[0].url}` };
    const titles = list.map((p) => p.parsed.title);
    const dup = titles.length - new Set(titles).size;
    if (dup > 0) {
      const seen = new Map();
      for (const p of list) seen.set(p.parsed.title, (seen.get(p.parsed.title) || 0) + 1);
      const worst = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ok: false, detail: `${dup} duplicate titles — "${worst[0].slice(0, 40)}" appears ${worst[1]}x` };
    }
    return { ok: true, detail: `${list.length} pages have distinct titles` };
  },

  descriptionPresent(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const missing = list.filter((p) => !p.parsed.meta['description']);
    if (missing.length) return { ok: false, detail: `${missing.length}/${list.length} pages have no meta description` };
    const descs = list.map((p) => p.parsed.meta['description']);
    const dup = descs.length - new Set(descs).size;
    if (dup > 0) return { ok: false, detail: `${dup} pages share the same description` };
    return { ok: true, detail: `${list.length} pages have distinct descriptions` };
  },

  llmsTxt(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.llms) return UNKNOWN('not checked');
    if (f.llms.error) return UNKNOWN(`request failed: ${f.llms.error}`);
    if (!f.llms.ok && f.local?.llms) return { ok: false, detail: `${f.local.llms} exists locally but is not live yet` };
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
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    if (!f.home.parsed?.lang) return { ok: false, detail: 'no lang attribute on <html>' };

    // Compare each page against its own lang. A bilingual site legitimately serves ko and
    // en side by side, so mixing one page's attribute with another page's text is wrong.
    const pct = (x) => `${Math.round(x * 100)}%`;
    const mismatches = [];
    let judged = 0;
    for (const p of list) {
      const lang = p.parsed.lang;
      // A JS-rendered shell has no content to compare against. CORE-12 owns that defect;
      // reporting it here too would blame the wrong thing.
      if (!lang || p.parsed.text.length < 500) continue;
      judged++;
      const r = scriptRatios(p.parsed.text);
      if (r.hangul >= 0.3 && !/^ko/.test(lang)) mismatches.push(`${p.url}: ${pct(r.hangul)} Hangul but lang=${lang}`);
      else if (r.kana >= 0.1 && !/^ja/.test(lang)) mismatches.push(`${p.url}: ${pct(r.kana)} kana but lang=${lang}`);
      else if (/^ko/.test(lang) && r.hangul < 0.05) mismatches.push(`${p.url}: lang=${lang} but ${pct(r.hangul)} Hangul`);
      else if (/^ja/.test(lang) && r.kana < 0.02) mismatches.push(`${p.url}: lang=${lang} but ${pct(r.kana)} kana`);
    }
    if (!judged) return UNKNOWN('no page had enough text in its initial HTML to judge the language (see CORE-12)');
    if (mismatches.length) return { ok: false, detail: mismatches.slice(0, 2).join(' · ') };
    return { ok: true, detail: `${judged} pages match their own lang attribute` };
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
    // A verification file sitting in the repo is a different situation from nothing at all.
    const localFile = (f.local?.verify || []).find((v) => a.localMatch && new RegExp(a.localMatch, 'i').test(v));
    if (localFile) {
      return { ok: true, detail: `verified by file ${localFile}` + (f.remote ? ' (deployed copy not probed — filename is only known locally)' : '') };
    }
    if (a.unknownIfMissing) return UNKNOWN(`${missing.join(', ')} absent — ${a.reason || 'another verification method may have been used'}`);
    return { ok: false, detail: `missing: ${missing.join(', ')}` };
  },

  indexNowKey(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.indexNowKey) {
      const local = f.local?.indexNowKeys?.[0];
      if (local) return { ok: false, detail: `key file ${local} exists locally but is not live yet — deploy it` };
      return { ok: false, detail: 'no key configured (.spb-seo-geo.json)' };
    }
    const { key, res, fromRepo } = f.indexNowKey;
    if (!res.ok) return { ok: false, detail: `/${key}.txt returned HTTP ${res.status}${fromRepo ? ' — the key file is in the repo but not live yet, so deploy it' : ''}` };
    if (res.body.trim() !== key) return { ok: false, detail: `/${key}.txt content does not match the key` };
    return { ok: true, detail: `/${key}.txt verified${fromRepo ? ' (key taken from the file in your repo)' : ''}` };
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

  contradictoryRobotsGroups(f) {
    const g = needRemote(f); if (g) return g;
    if (!f.robots?.res?.ok) return UNKNOWN('could not read robots.txt');
    const watched = [...AI_BOTS.cite, ...AI_BOTS.user, ...AI_BOTS.train, 'Yeti', 'bingbot', 'Googlebot'];
    const bad = contradictoryGroups(f.robots.parsed, watched);
    if (bad.length) return { ok: false, detail: `contradictory rules for ${bad.join(', ')} — merged result allows, but the intent is unclear` };
    return { ok: true };
  },

  // Did AI crawlers actually fetch the site? Being allowed proves nothing on its own.
  aiCrawlerActivity(f, a) {
    const log = f.accessLog;
    if (!log) return UNKNOWN('no access log provided (--access-log <file>) — allowance alone does not prove anything was fetched');
    if (!log.ok) return UNKNOWN(log.error);
    const fam = log.families[a.family] || [];
    const hits = fam.reduce((n, x) => n + x.hits, 0);
    const window = log.hasDates ? `last ${log.window}d` : 'whole file (no parsable dates)';
    if (!hits) {
      return { ok: false, detail: `no ${BOT_FAMILIES[a.family].label} crawler fetches found (${window}). Checked: ${BOT_FAMILIES[a.family].uas.join(', ')}` };
    }
    const top = fam.slice(0, 3).map((x) => `${x.ua} ${x.hits}${x.last ? ` (last ${x.last})` : ''}`).join(' · ');
    return { ok: true, detail: `${hits} fetches in ${window} — ${top}` };
  },

  // A bot fetching paths it was told to leave alone, or a policy that is not being honoured.
  crawlerPolicyRespected(f) {
    const log = f.accessLog;
    if (!log) return UNKNOWN('no access log provided (--access-log <file>)');
    if (!log.ok) return UNKNOWN(log.error);
    if (!f.robots?.res?.ok) return UNKNOWN('no robots.txt to compare against');
    const offenders = [];
    for (const key of ['train', 'cite']) {
      for (const rec of log.families[key] || []) {
        const allowed = isAllowed(f.robots.parsed, rec.ua, '/').allowed;
        if (!allowed && rec.hits > 0) offenders.push(`${rec.ua} fetched ${rec.hits}x while disallowed`);
      }
    }
    if (offenders.length) return { ok: false, detail: offenders.join(' · ') };
    return { ok: true, detail: 'no disallowed crawler activity found' };
  },

  // Skipped levels only. Google is explicit that h1 count does not matter — "your site is
  // going to rank perfectly fine with no H1 tags or with five H1 tags" — so flagging that
  // would be folklore, not a finding. A jump like h1 → h3 is still worth mentioning: it is
  // usually styling driving structure, and it costs screen-reader users the outline.
  headingStructure(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const problems = [];
    for (const p of list) {
      const hs = p.parsed.headings;
      if (!hs.length) continue;
      const jump = hs.find((h, i) => i > 0 && h.level - hs[i - 1].level > 1);
      if (jump) problems.push(`${p.url} jumps to h${jump.level} ("${jump.text.slice(0, 30)}")`);
    }
    if (problems.length) return { ok: false, detail: problems.slice(0, 2).join(' · ') };
    return { ok: true, detail: `${list.length} pages have no skipped heading levels` };
  },

  // Undated content is hard to trust and hard to cite.
  contentFreshness(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    if (!list.length) return UNKNOWN('could not read the HTML');
    const undated = list.filter((p) => {
      if (p.parsed.timeTags.length) return false;
      const ld = p.parsed.jsonLd.join(' ');
      return !/date(Published|Modified)/i.test(ld) && !p.parsed.meta['article:modified_time'];
    });
    if (undated.length === list.length) return { ok: false, detail: `none of ${list.length} sampled pages expose a date` };
    if (undated.length) return { ok: false, detail: `${undated.length}/${list.length} pages expose no date — e.g. ${undated[0].url}` };
    return { ok: true, detail: `${list.length} pages carry a date` };
  },

  // Who is this? Entity markup is how an answer engine attributes a claim to someone.
  entityMarkup(f) {
    const g = needRemote(f); if (g) return g;
    const list = pages(f);
    const blocks = list.flatMap((p) => p.parsed.jsonLd);
    if (!blocks.length) return { ok: false, detail: 'no JSON-LD at all — no Organization or Person to attribute content to' };
    let hasEntity = false, hasSameAs = false;
    for (const b of blocks) {
      try {
        const j = JSON.parse(b);
        const all = JSON.stringify(Array.isArray(j) ? j : [j]);
        if (/"@type"\s*:\s*"?(Organization|Person|LocalBusiness|NewsMediaOrganization)/.test(all)) hasEntity = true;
        if (/"sameAs"/.test(all)) hasSameAs = true;
      } catch {}
    }
    if (!hasEntity) return { ok: false, detail: 'JSON-LD present but no Organization or Person entity' };
    return { ok: true, detail: hasSameAs ? 'entity with sameAs links' : 'entity present (consider sameAs for disambiguation)' };
  },

  manual(f, a) {
    return { ok: null, detail: 'there is no way to check this from outside', todo: a.todo || [] };
  },

  rssPresent(f) {
    const g = needRemote(f); if (g) return g;
    const good = f.feeds.filter((x) => x.parsed?.valid && x.parsed.items.length > 0);
    if (!good.length) {
      if (f.local?.rss) return { ok: false, detail: `${f.local.rss} exists locally but is not live yet — deploy it` };
      return { ok: false, detail: f.feeds.length ? 'found a feed but it has no valid items' : 'no feed found' };
    }
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
    if (!f.sitemapEntries?.length) return UNKNOWN('no sitemap to compare against');
    const linked = new Set(f.linkedUrls || []);
    if (!linked.size) return UNKNOWN('no internal links found on the pages we read');
    linked.add(f.home.url.replace(/\/$/, ''));
    const crawled = 1 + f.samples.filter((s) => s.parsed).length;
    const orphans = f.sitemapEntries
      .map((e) => e.loc.replace(/\/$/, ''))
      .filter((u) => !linked.has(u));
    // We only read a handful of pages, so "some are unlinked" says nothing. Only the
    // absolute case is a finding — anything softer flapped between runs on a dynamic home
    // page, and a flaky verdict is worse than no verdict.
    if (orphans.length === f.sitemapEntries.length && f.sitemapEntries.length > 3) {
      return { ok: false, detail: `none of ${f.sitemapEntries.length} sitemap URLs are linked from the ${crawled} pages we read` };
    }
    return { ok: true, detail: `${f.sitemapEntries.length - orphans.length}/${f.sitemapEntries.length} sitemap URLs linked from the ${crawled} pages we read` };
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
