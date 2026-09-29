// sitemap and rss parsing, also regex-based (zero dependencies).
const inner = (xml, tag) => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
};

const unescape = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

export function parseSitemap(xml = '') {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const blocks = inner(xml, isIndex ? 'sitemap' : 'url');
  const entries = blocks.map((b) => ({
    loc: unescape(inner(b, 'loc')[0] || ''),
    lastmod: inner(b, 'lastmod')[0] || null,
  })).filter((e) => e.loc);
  return { isIndex, entries, valid: /<(urlset|sitemapindex)[\s>]/i.test(xml) };
}

export function parseFeed(xml = '') {
  const isAtom = /<feed[\s>]/i.test(xml);
  const blocks = inner(xml, isAtom ? 'entry' : 'item');
  const items = blocks.map((b) => {
    let link = unescape(inner(b, 'link')[0] || '');
    if (isAtom && !link) {
      const m = /<link[^>]*href\s*=\s*["']([^"']+)["']/i.exec(b);
      link = m ? m[1] : '';
    }
    return { title: unescape(inner(b, 'title')[0] || ''), link };
  });
  return { valid: /<(rss|feed)[\s>]/i.test(xml), isAtom, items };
}

// Does this look like a W3C Datetime? (CORE-07)
export const isValidLastmod = (v) =>
  !!v && /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/.test(v.trim());
