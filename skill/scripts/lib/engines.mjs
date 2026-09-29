// Which optional engines to include.
//
// We ask by engine name, not by country: someone knows whether they want to show up
// on Naver, but making them reason about "which countries matter" is our problem, not
// theirs. Signals from the page only pre-fill a suggestion — they never decide.
import { scriptRatios } from './html.mjs';

export const OPTIONAL_ENGINES = ['naver', 'yahoo'];
export const LABEL = { naver: 'Naver (Korea)', yahoo: 'Yahoo! JAPAN (Japan)' };

// Each optional engine dominates in one language, so that is what the signals look for.
const SIGNALS = {
  naver: {
    tld: ['.kr'],
    lang: /^ko(-|$)/,
    ogLocale: /^ko[_-]kr$/i,
    hreflang: 'ko',
    script: { key: 'hangul', min: 0.2, label: 'Hangul' },
    tags: ['naver-site-verification'],
    thirdParty: ['wcs.naver.net', 'wcslog.js', 'developers.kakao.com', 'kakao.min.js', 'channel.io', 'nsight.naver.com', 't1.daumcdn.net'],
  },
  yahoo: {
    tld: ['.jp'],
    lang: /^ja(-|$)/,
    ogLocale: /^ja[_-]jp$/i,
    hreflang: 'ja',
    // Kana, not kanji: kanji is shared with Chinese, kana is not.
    script: { key: 'kana', min: 0.05, label: 'kana' },
    tags: [],
    thirdParty: ['yjtag.yahoo.co.jp', 's.yimg.jp', 'yads.c.yimg.jp', 'b.yjtag.jp', 'line-scdn.net'],
  },
};

// Accepts "naver" · "naver,yahoo" · "none" / "global" · null
export function parseEngines(v) {
  if (!v || v === 'auto' || v === true) return null;
  const parts = String(v).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.includes('none') || parts.includes('global')) return [];
  const picked = parts.filter((p) => OPTIONAL_ENGINES.includes(p));
  return picked.length ? picked : null;
}

// Phase 1: the answer we already have, plus what the domain alone tells us.
export function enginesPhase1({ option, saved, url }) {
  const answered = parseEngines(option) ?? parseEngines(saved);
  const suggested = {};
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  for (const e of OPTIONAL_ENGINES) {
    if (SIGNALS[e].tld.some((t) => host.endsWith(t))) suggested[e] = [`${host.split('.').slice(-2).join('.')} domain`];
  }
  if (answered) {
    return { engines: answered, answered: true, source: parseEngines(option) ? '--engines' : '.spb-seo-geo.json', suggested, final: true };
  }
  return { engines: [], answered: false, suggested, final: false };
}

// Phase 2: signals that need the HTML. They only refine the suggestion.
export function enginesPhase2(phase1, pages = []) {
  const found = Object.fromEntries(OPTIONAL_ENGINES.map((e) => [e, { tag: null, tld: phase1.suggested[e]?.[0] || null, script: 0, lang: null, hreflang: null, ogLocale: null, thirdParty: null }]));

  for (const p of pages) {
    if (!p || !p.parsed) continue;
    const h = p.parsed;
    const ratios = scriptRatios(h.text);
    for (const e of OPTIONAL_ENGINES) {
      const S = SIGNALS[e], f = found[e];
      for (const t of S.tags) if (h.meta[t]) f.tag = `${t} tag`;
      if (ratios[S.script.key] > f.script) f.script = ratios[S.script.key];
      if (!f.lang && S.lang.test(h.lang)) f.lang = `lang=${h.lang}`;
      if (!f.hreflang && h.hreflangs.some((x) => S.lang.test(x))) f.hreflang = `hreflang ${S.hreflang}`;
      if (!f.ogLocale && S.ogLocale.test(h.property['og:locale'] || '')) f.ogLocale = `og:locale ${S.hreflang}_${S.tld[0].slice(1).toUpperCase()}`;
      if (!f.thirdParty) {
        const hit = S.thirdParty.find((x) => h.scripts.includes(x));
        if (hit) f.thirdParty = `regional script (${hit})`;
      }
    }
  }

  const suggested = {};
  for (const e of OPTIONAL_ENGINES) {
    const f = found[e], S = SIGNALS[e];
    const why = [f.tag, f.tld].filter(Boolean);
    if (f.script >= S.script.min) why.push(`${Math.round(f.script * 100)}% ${S.script.label}`);
    for (const k of ['lang', 'hreflang', 'ogLocale']) if (f[k]) why.push(f[k]);
    if (why.length) suggested[e] = why;
    else if (f.thirdParty) suggested[e] = [`${f.thirdParty} (weak)`];
  }

  return { ...phase1, suggested };
}

// Not a gate. Everything is checked for everyone; this only says which optional
// console work is likely to be worth the user's time.
export function enginesSentence(s) {
  const sug = Object.keys(s.suggested || {});
  if (s.answered) {
    if (!s.engines.length) return ['Optional engines: none selected.'];
    return [`Optional engines: ${s.engines.map((k) => LABEL[k]).join(', ')}  (set by ${s.source})`];
  }
  if (!sug.length) return [];
  return [`Signals suggest you may want: ${sug.map((k) => `${LABEL[k]} — ${s.suggested[k].join(' · ')}`).join('  |  ')}`];
}

export const enginesValue = (s) => (s.answered ? (s.engines.join(',') || 'none') : 'not-set');
