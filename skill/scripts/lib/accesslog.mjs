// Access-log analysis: the only deterministic way to know whether AI crawlers actually
// reach the site. Being "allowed" in robots.txt proves nothing — a page nobody fetched
// cannot be cited. This is free evidence that most GEO tooling ignores.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

export const BOT_FAMILIES = {
  // Citation: these fetches are what make a page eligible to appear in an AI answer.
  cite: { label: 'citation', uas: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'Applebot'] },
  // Training: excluded from answers either way; only relevant to policy intent.
  train: { label: 'training', uas: ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Bytespider', 'meta-externalagent'] },
  // User-triggered: a real person opened the link inside an AI product. The strongest signal.
  user: { label: 'user-triggered', uas: ['ChatGPT-User', 'Claude-User', 'Perplexity-User'] },
  // Classic search crawlers, for comparison.
  search: { label: 'search', uas: ['Googlebot', 'bingbot', 'Yeti', 'Y!J-', 'DuckDuckBot', 'YandexBot'] },
};

const MAX_BYTES = 200 * 1024 * 1024;

// Log formats differ wildly; we only need the user agent, the path and a date, so we
// look for those rather than trying to fully parse any one format.
const DATE_RE = /\[(\d{2})\/([A-Za-z]{3})\/(\d{4})|"?(\d{4}-\d{2}-\d{2})/;
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const PATH_RE = /"(?:GET|HEAD|POST) ([^ "]+)|"path":"([^"]+)"|"clientRequestPath":"([^"]+)"/;

function dateOf(line) {
  const m = DATE_RE.exec(line);
  if (!m) return null;
  if (m[4]) return m[4];
  if (m[1] && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1]}`;
  return null;
}

export function analyze(path, { window = 30 } = {}) {
  if (!existsSync(path)) return { ok: false, error: `no such file: ${path}` };
  const size = statSync(path).size;
  if (size > MAX_BYTES) return { ok: false, error: `log is ${Math.round(size / 1048576)}MB — pre-filter it with grep first` };

  let text;
  try {
    // Gzipped logs are the norm for anything rotated.
    text = /\.gz$/.test(path) ? execSync(`gzip -dc ${JSON.stringify(path)}`, { maxBuffer: MAX_BYTES, encoding: 'utf8' })
                              : readFileSync(path, 'utf8');
  } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 120) }; }

  const cutoff = new Date(Date.now() - window * 86400e3).toISOString().slice(0, 10);
  const stats = {};
  for (const key of Object.keys(BOT_FAMILIES)) stats[key] = {};
  let lines = 0, dated = 0, inWindow = 0, blockedHits = [];

  for (const line of text.split('\n')) {
    if (!line) continue;
    lines++;
    const d = dateOf(line);
    if (d) { dated++; if (d >= cutoff) inWindow++; else continue; }

    for (const [key, fam] of Object.entries(BOT_FAMILIES)) {
      for (const ua of fam.uas) {
        if (!line.includes(ua)) continue;
        const rec = (stats[key][ua] ||= { hits: 0, last: null, paths: new Set() });
        rec.hits++;
        if (d && (!rec.last || d > rec.last)) rec.last = d;
        const pm = PATH_RE.exec(line);
        if (pm && rec.paths.size < 5) rec.paths.add(pm[1] || pm[2] || pm[3]);
        blockedHits.push({ ua, key });
        break;
      }
    }
  }

  const summarise = (key) => Object.entries(stats[key])
    .map(([ua, r]) => ({ ua, hits: r.hits, last: r.last, paths: [...r.paths] }))
    .sort((a, b) => b.hits - a.hits);

  return {
    ok: true, path, lines, dated, inWindow, window,
    hasDates: dated > lines * 0.5,
    families: Object.fromEntries(Object.keys(BOT_FAMILIES).map((k) => [k, summarise(k)])),
    total: blockedHits.length,
  };
}
