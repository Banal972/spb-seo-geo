// File generators. We only manage what is inside our marker comments (invariant 6).
import { randomBytes } from 'node:crypto';

export const MARK_START = '# >>> spb-seo-geo';
export const MARK_END = '# <<< spb-seo-geo';

export const AI_BOTS = {
  cite: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'],
  user: ['ChatGPT-User', 'Claude-User', 'Perplexity-User'],
  train: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'meta-externalagent', 'Bytespider'],
};

export function robotsBlock({ policy = 'open', sitemapUrl } = {}) {
  const L = [`${MARK_START} (ai-policy=${policy}) — only this block is managed`];
  L.push('# Citation bots: blocking these removes you from AI answers');
  for (const ua of AI_BOTS.cite) L.push(`User-agent: ${ua}`, 'Allow: /', '');
  L.push('# User-triggered fetches (a person opening a link inside an AI product)');
  for (const ua of AI_BOTS.user) L.push(`User-agent: ${ua}`, 'Allow: /', '');
  L.push(`# Training bots (${policy === 'open' ? 'allowed' : 'blocked'})`);
  for (const ua of AI_BOTS.train) L.push(`User-agent: ${ua}`, policy === 'open' ? 'Allow: /' : 'Disallow: /', '');
  if (sitemapUrl) L.push(`Sitemap: ${sitemapUrl}`);
  L.push(MARK_END);
  return L.join('\n');
}

// Preserve the existing file and only replace or append our own block
export function mergeRobots(existing = '', block) {
  const s = existing.indexOf(MARK_START);
  const e = existing.indexOf(MARK_END);
  if (s > -1 && e > s) {
    return existing.slice(0, s) + block + existing.slice(e + MARK_END.length);
  }
  const base = existing.trim() ? existing.trimEnd() + '\n\n' : 'User-agent: *\nAllow: /\n\n';
  return base + block + '\n';
}

export function sitemapXml(origin, routes, lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = routes.map((r) => {
    const loc = new URL(r === '/' ? '/' : r, origin).toString();
    return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// RSS exists for Naver. It is generated statically, so it must be refreshed on deploy.
export function rssXml({ origin, title, description, items }) {
  const now = new Date().toUTCString();
  const entries = items.map((i) => [
    '    <item>',
    `      <title>${esc(i.title || i.url)}</title>`,
    `      <link>${esc(i.url)}</link>`,
    `      <guid isPermaLink="true">${esc(i.url)}</guid>`,
    `      <pubDate>${i.date ? new Date(i.date).toUTCString() : now}</pubDate>`,
    '    </item>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    `    <title>${esc(title || origin)}</title>`,
    `    <link>${esc(origin)}</link>`,
    `    <description>${esc(description || title || origin)}</description>`,
    `    <lastBuildDate>${now}</lastBuildDate>`,
    ...entries,
    '</channel></rss>',
    '',
  ].join('\n');
}

export const indexNowKey = () => randomBytes(16).toString('hex');
export const indexNowKeyFile = (key) => key + '\n';

export function llmsTxt({ title, origin, pages = [] }) {
  const L = [`# ${title || origin}`, '', `> ${origin}`, '', '## Pages', ''];
  for (const p of pages.slice(0, 50)) L.push(`- [${p.title || p.url}](${p.url})`);
  L.push('');
  return L.join('\n');
}

export const verifyMeta = (name, token) => `<meta name="${name}" content="${esc(token)}" />`;

export function ogSnippet({ title, description, image }) {
  return [
    `<meta property="og:title" content="${esc(title || '')}" />`,
    `<meta property="og:description" content="${esc(description || '')}" />`,
    `<meta property="og:image" content="${esc(image || '')}" />`,
  ].join('\n');
}

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
