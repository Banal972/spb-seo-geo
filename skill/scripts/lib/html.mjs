// Zero-dependency policy means a regex-based <head> extractor instead of a real parser.
// Limits: weak against tags inside comments and malformed nesting. Use only for <head> meta/link extraction.

const headOf = (html) => {
  const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return m ? m[1] : html.slice(0, 40000);
};

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}

const tags = (src, name) => (src.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []).map(attrs);

export function parseHtml(html = '') {
  const head = headOf(html);
  const metas = tags(head, 'meta');
  const links = tags(head, 'link');
  const htmlTag = attrs((/<html\b[^>]*>/i.exec(html) || [''])[0]);

  const meta = {};      // name -> content
  const property = {};  // property -> content
  for (const m of metas) {
    if (m.name) meta[m.name.toLowerCase()] = m.content ?? '';
    if (m.property) property[m.property.toLowerCase()] = m.content ?? '';
  }

  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] || '').trim();

  const canonical = links.find((l) => (l.rel || '').toLowerCase().includes('canonical'))?.href || null;
  const feeds = links
    .filter((l) => /alternate/i.test(l.rel || '') && /(rss|atom)\+xml/i.test(l.type || ''))
    .map((l) => l.href);
  const hreflangs = links
    .filter((l) => (l.rel || '').toLowerCase() === 'alternate' && l.hreflang)
    .map((l) => l.hreflang.toLowerCase());

  // Body text: drop script/style/noscript, then strip tags
  const bodySrc = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] || html);
  const stripped = bodySrc
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const text = stripped.replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

  const imgs = (bodySrc.match(/<img\b/gi) || []).length;
  const lists = (bodySrc.match(/<(ul|ol|table|dl)\b/gi) || []).length;
  const anchors = (bodySrc.match(/<a\b[^>]*>/gi) || []).map(attrs);

  // Heading structure and dates: both feed retrieval, and both are deterministic.
  const headings = [...bodySrc.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text);
  const timeTags = [...bodySrc.matchAll(/<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);

  const jsonLd = [];
  const ldRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld;
  while ((ld = ldRe.exec(html))) jsonLd.push(ld[1]);

  const robotsMeta = [meta['robots'], meta['googlebot']].filter(Boolean).join(',').toLowerCase();
  const hasDataNosnippet = /\sdata-nosnippet\b/i.test(html);

  return {
    lang: (htmlTag.lang || '').toLowerCase(),
    title, meta, property, canonical, feeds, hreflangs,
    text, textLen: text.length, imgs, lists, anchors, jsonLd,
    robotsMeta, hasDataNosnippet, headings, timeTags, isArticle: articleLike(html, bodySrc),
    scripts: (html.match(/<script\b[^>]*src\s*=\s*["']([^"']+)["']/gi) || []).join(' '),
  };
}

// Is this a page where a publication date and structured prose actually mean something?
// A landing page has neither and should not be judged as if it were a blog post.
function articleLike(html, body) {
  if (/<article[\s>]/i.test(body)) return true;
  if (/"@type"\s*:\s*"?(Article|BlogPosting|NewsArticle|TechArticle|Report)/i.test(html)) return true;
  if (/property\s*=\s*["']og:type["'][^>]*content\s*=\s*["']article["']/i.test(html)) return true;
  return false;
}

// Script ratios. The most reliable signals for suggesting optional engines, because unlike a
// lang attribute they come from the content itself and cannot be left at a framework default.
// Japanese is detected by kana, not kanji: kanji is shared with Chinese, kana is not.
export function scriptRatios(text = '') {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, '');
  if (!letters.length) return { hangul: 0, kana: 0, letters: 0 };
  const hangul = (letters.match(/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const kana = (letters.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  return { hangul: hangul / letters.length, kana: kana / letters.length, letters: letters.length };
}

export const hangulRatio = (text = '') => scriptRatios(text).hangul;
export const kanaRatio = (text = '') => scriptRatios(text).kana;


// Citation signals: statistics, quotations, outbound links (GEO-06)
export function citationSignals(page) {
  const numbers = (page.text.match(/\b\d+([.,]\d+)?\s*(%|명|개|건|원|억|만|배|초|분|시간|년|월|일|kg|km|ms|USD|\$)/g) || []).length;
  const quotes = (page.text.match(/[“"”][^“"”]{20,}[“"”]/g) || []).length;
  let host = '';
  try { host = new URL(page.url).host; } catch {}
  const external = page.anchors.filter((a) => {
    if (!a.href) return false;
    try { return new URL(a.href, page.url).host !== host; } catch { return false; }
  }).length;
  return { numbers, quotes, external };
}
