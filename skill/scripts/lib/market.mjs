// Market detection: kr / global / undecided.
// Principle: absence is not evidence. No signal means undecided, not global.
import { hangulRatio } from './html.mjs';

export const KR_SCRIPT_HINTS = [
  'wcs.naver.net', 'wcslog.js', 'developers.kakao.com', 'kakao.min.js',
  'channel.io', 'nsight.naver.com', 't1.daumcdn.net',
];

// Phase 1: only what is knowable before fetching (flag, saved config, TLD)
export function marketPhase1({ option, saved, url }) {
  if (option === 'kr' || option === 'global') {
    return { market: option, basis: ['--market flag'], final: true };
  }
  if (saved === 'kr' || saved === 'global') {
    return { market: saved, basis: ['saved in .spb-seo-geo.json'], final: true };
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('.kr')) return { market: 'kr', basis: [`${host.split('.').slice(-2).join('.')} domain`], final: false };
  } catch {}
  return { market: 'undecided', basis: [], final: false };
}

// Phase 2: signals that require the HTML. OR logic: any single hit means kr.
export function marketPhase2(phase1, pages = []) {
  if (phase1.final) return phase1;

  // Count each signal kind once. Repeating it per page turns the rationale line into noise.
  const sig = { tld: null, verify: null, hangul: 0, lang: null, hreflang: null, oglocale: null, script: null };
  const tld = phase1.basis.find((b) => b.endsWith('domain'));
  if (tld) sig.tld = tld;

  for (const p of pages) {
    if (!p || !p.parsed) continue;
    const h = p.parsed;
    if (h.meta['naver-site-verification']) sig.verify = 'naver-site-verification tag';
    const ratio = hangulRatio(h.text);
    if (ratio > sig.hangul) sig.hangul = ratio;
    if (!sig.lang && /^ko(-|$)/.test(h.lang)) sig.lang = `lang=${h.lang}`;
    if (!sig.hreflang && h.hreflangs.some((x) => /^ko(-|$)/.test(x))) sig.hreflang = 'hreflang ko';
    if (!sig.oglocale && /^ko[_-]kr$/i.test(h.property['og:locale'] || '')) sig.oglocale = 'og:locale ko_KR';
    if (!sig.script) {
      const hint = KR_SCRIPT_HINTS.find((x) => h.scripts.includes(x));
      if (hint) sig.script = `Korean-market script (${hint})`;
    }
  }

  const strong = [sig.verify, sig.tld].filter(Boolean);
  if (sig.hangul >= 0.2) strong.push(`${Math.round(sig.hangul * 100)}% Hangul`);
  for (const k of ['lang', 'hreflang', 'oglocale']) if (sig[k]) strong.push(sig[k]);

  if (strong.length) return { market: 'kr', basis: strong, final: false };
  if (sig.script) return { market: 'kr', basis: [sig.script], final: false, weak: true };
  if (phase1.market === 'global') return phase1;
  return { market: 'undecided', basis: [], final: false };
}

// Report the verdict as a sentence, not just a symbol.
export function marketSentence(m) {
  if (m.market === 'kr') {
    return [
      'Treating this site as targeting Korea, so Naver checks are included.',
      `  Basis: ${m.basis.join(' · ')}${m.weak ? ' (weak signal)' : ''}   (override with --market=global)`,
    ];
  }
  if (m.market === 'global') {
    return ['Marked as not targeting Korea, so the 4 Naver-only rules were not evaluated.', '  If you do target Korean users, pass --market=kr'];
  }
  return [
    'No signal that this site targets Korea, so the 4 Naver-only rules were not evaluated.',
    '  A freshly deployed site may have no signal yet. If you target Korean users, pass --market=kr',
  ];
}
