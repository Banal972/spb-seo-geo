// Fetch layer. The agent never sees these raw results (invariant 1).
const UA = 'spb-seo-geo/0.1 (+https://github.com/Banal972/spb-seo-geo)';
const TIMEOUT = 8000;

export async function get(url, { timeout = TIMEOUT, method = 'GET', maxRedirects = 5 } = {}) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(current, {
        method, redirect: 'manual', signal: ac.signal,
        headers: { 'user-agent': UA, accept: '*/*' },
      });
      clearTimeout(t);
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        chain.push({ from: current, status: res.status });
        current = new URL(loc, current).toString();
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      const body = method === 'HEAD' ? '' : await res.text();
      return {
        ok: res.ok, status: res.status, url: current, requested: url,
        contentType: ct, headers: Object.fromEntries(res.headers), body,
        redirects: chain, bytes: Buffer.byteLength(body || ''),
      };
    } catch (e) {
      clearTimeout(t);
      return { ok: false, status: 0, url: current, requested: url, error: String(e?.message || e), redirects: chain, body: '', headers: {}, contentType: '' };
    }
  }
  return { ok: false, status: 0, url: current, requested: url, error: 'too many redirects', redirects: chain, body: '', headers: {}, contentType: '' };
}

// Concurrency limit. Do not hammer someone else's server.
export async function pool(items, worker, limit = 6) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }));
  return results;
}
