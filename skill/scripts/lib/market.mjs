// Which regional engines apply to this site.
//
// Intent is not inferable. Which countries you want traffic from is a business
// decision, not a property of your HTML — so we ASK, once, and remember the answer.
// Signals are used only to pre-fill a suggestion, never to decide silently.
import { scriptRatios } from './html.mjs';

export const MARKETS = ['kr', 'jp'];
export const LABEL = { kr: 'Naver (Korea)', jp: 'Yahoo! JAPAN (Japan)' };

const HINTS = {
  kr: ['wcs.naver.net', 'wcslog.js', 'developers.kakao.com', 'kakao.min.js', 'channel.io', 'nsight.naver.com', 't1.daumcdn.net'],
  jp: ['yjtag.yahoo.co.jp', 's.yimg.jp', 'yads.c.yimg.jp', 'b.yjtag.jp', 'line-scdn.net'],
};
const TLD = { kr: ['.kr'], jp: ['.jp'] };
const LANG = { kr: /^ko(-|$)/, jp: /^ja(-|$)/ };
const OG_LOCALE = { kr: /^ko[_-]kr$/i, jp: /^ja[_-]jp$/i };
// Kana is decisive for Japanese (kanji is shared with Chinese); Hangul for Korean.
const SCRIPT = { kr: { key: 'hangul', min: 0.2, label: 'Hangul' }, jp: { key: 'kana', min: 0.05, label: 'kana' } };

// Accepts "kr" · "kr,jp" · "global" / "none" · null
export function parseMarkets(v) {
  if (!v || v === 'auto' || v === true) return null;
  const parts = String(v).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.includes('global') || parts.includes('none')) return [];
  const markets = parts.filter((p) => MARKETS.includes(p));
  return markets.length ? markets : null;
}

// Phase 1: what is knowable before fetching — the answer we already have, plus TLD.
export function marketPhase1({ option, saved, url }) {
  const answered = parseMarkets(option) ?? parseMarkets(saved);
  const suggested = {};
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  for (const m of MARKETS) {
    if (TLD[m].some((t) => host.endsWith(t))) suggested[m] = [`${host.split('.').slice(-2).join('.')} domain`];
  }
  if (answered) {
    return { markets: answered, answered: true, source: parseMarkets(option) ? '--market' : '.spb-seo-geo.json', suggested, final: true };
  }
  return { markets: [], answered: false, suggested, final: false };
}

// Phase 2: signals from the HTML. They only refine the suggestion.
export function marketPhase2(phase1, pages = []) {
  const found = Object.fromEntries(MARKETS.map((m) => [m, { verify: null, tld: null, script: 0, lang: null, hreflang: null, oglocale: null, hint: null }]));
  for (const m of MARKETS) if (phase1.suggested[m]) found[m].tld = phase1.suggested[m][0];

  for (const p of pages) {
    if (!p || !p.parsed) continue;
    const h = p.parsed;
    const ratios = scriptRatios(h.text);
    if (h.meta['naver-site-verification']) found.kr.verify = 'naver-site-verification tag';
    for (const m of MARKETS) {
      const sc = SCRIPT[m];
      if (ratios[sc.key] > found[m].script) found[m].script = ratios[sc.key];
      if (!found[m].lang && LANG[m].test(h.lang)) found[m].lang = `lang=${h.lang}`;
      if (!found[m].hreflang && h.hreflangs.some((x) => LANG[m].test(x))) found[m].hreflang = `hreflang ${m === 'kr' ? 'ko' : 'ja'}`;
      if (!found[m].oglocale && OG_LOCALE[m].test(h.property['og:locale'] || '')) found[m].oglocale = `og:locale ${m === 'kr' ? 'ko_KR' : 'ja_JP'}`;
      if (!found[m].hint) {
        const hint = HINTS[m].find((x) => h.scripts.includes(x));
        if (hint) found[m].hint = `regional script (${hint})`;
      }
    }
  }

  const suggested = {};
  for (const m of MARKETS) {
    const f = found[m];
    const why = [f.verify, f.tld].filter(Boolean);
    if (f.script >= SCRIPT[m].min) why.push(`${Math.round(f.script * 100)}% ${SCRIPT[m].label}`);
    for (const k of ['lang', 'hreflang', 'oglocale']) if (f[k]) why.push(f[k]);
    if (why.length) suggested[m] = why;
    else if (f.hint) suggested[m] = [`${f.hint} (weak)`];
  }

  return { ...phase1, suggested };
}

// Regions are not a gate. Everything is checked for everyone; this only states which
// optional console work is likely to be worth the user's time.
export function marketSentence(m) {
  const sug = Object.keys(m.suggested || {});
  if (m.answered) {
    if (!m.markets.length) return ['Regional console steps: hidden (--market=global).'];
    return [`Regional console steps: ${m.markets.map((k) => LABEL[k]).join(', ')} only  (set by ${m.source})`];
  }
  if (!sug.length) return [];
  return [`Regional signals: ${sug.map((k) => `${LABEL[k]} — ${m.suggested[k].join(' · ')}`).join('  |  ')}`];
}

export const marketValue = (m) => (m.answered ? (m.markets.join(',') || 'global') : 'all');
