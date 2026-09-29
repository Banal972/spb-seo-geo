// robots.txt parsing and user-agent group matching.
// Verdict accuracy depends on this (NAVER-02, BING-02, GEO-01/03).

export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (field === 'sitemap') { sitemaps.push(value); continue; }
    if (!cur) continue;
    lastWasAgent = false;
    if (field === 'allow' || field === 'disallow') cur.rules.push({ type: field, path: value });
    else cur.rules.push({ type: field, path: value, other: true });
  }
  return { groups, sitemaps, raw: text };
}

// Pick the group that applies to this UA. The most specific (longest) match wins.
export function groupFor(robots, ua) {
  const target = String(ua).toLowerCase();
  let best = null, bestLen = -1, star = null;
  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a === '*') { if (!star) star = g; continue; }
      if (target === a || target.startsWith(a)) {
        if (a.length > bestLen) { best = g; bestLen = a.length; }
      }
    }
  }
  return best || star || null;
}

function toRegex(pattern) {
  let p = pattern;
  let anchorEnd = false;
  if (p.endsWith('$')) { anchorEnd = true; p = p.slice(0, -1); }
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + (anchorEnd ? '$' : ''));
}

// Per spec: the longest matching rule wins; on a tie, allow wins.
export function isAllowed(robots, ua, path = '/') {
  const g = groupFor(robots, ua);
  if (!g) return { allowed: true, by: null, group: null };
  let winner = null;
  for (const r of g.rules) {
    if (r.other) continue;
    if (r.type === 'disallow' && r.path === '') continue; // an empty Disallow means allow everything
    if (!toRegex(r.path).test(path)) continue;
    const len = r.path.length;
    if (!winner || len > winner.path.length || (len === winner.path.length && r.type === 'allow')) winner = r;
  }
  if (!winner) return { allowed: true, by: null, group: g };
  return { allowed: winner.type === 'allow', by: winner, group: g };
}

// Is the whole site blocked? (CORE-02)
export function blocksEverything(robots, ua = '*') {
  const g = groupFor(robots, ua);
  if (!g) return false;
  return g.rules.some((r) => r.type === 'disallow' && r.path === '/');
}

export function hasExplicitGroup(robots, ua) {
  const target = String(ua).toLowerCase();
  return robots.groups.some((g) => g.agents.some((a) => a !== '*' && (target === a || target.startsWith(a))));
}
