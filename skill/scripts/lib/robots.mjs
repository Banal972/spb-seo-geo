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

// RFC 9309 §2.2.1: if more than one group matches the user agent, the matching groups'
// rules MUST be combined into one group. Reading only the first match is a real bug — it
// reports a block that compliant crawlers would not honour.
export function matchingGroups(robots, ua) {
  const target = String(ua).toLowerCase();
  let best = -1, groups = [], star = [];
  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a === '*') { star.push(g); continue; }
      if (target === a || target.startsWith(a)) {
        if (a.length > best) { best = a.length; groups = [g]; }
        else if (a.length === best) groups.push(g);
      }
    }
  }
  return groups.length ? groups : star;
}

// Kept for callers that only need one group's worth of context.
export const groupFor = (robots, ua) => matchingGroups(robots, ua)[0] || null;

export const rulesFor = (robots, ua) =>
  matchingGroups(robots, ua).flatMap((g) => g.rules).filter((r) => !r.other);

function toRegex(pattern) {
  let p = pattern;
  let anchorEnd = false;
  if (p.endsWith('$')) { anchorEnd = true; p = p.slice(0, -1); }
  const escaped = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + (anchorEnd ? '$' : ''));
}

// Per spec: rules from all matching groups are merged, the longest match wins, and on a
// tie allow wins — in either written order.
export function isAllowed(robots, ua, path = '/') {
  const rules = rulesFor(robots, ua);
  if (!rules.length) return { allowed: true, by: null };
  let winner = null;
  for (const r of rules) {
    if (r.type === 'disallow' && r.path === '') continue; // an empty Disallow means allow everything
    if (!toRegex(r.path).test(path)) continue;
    const len = r.path.length;
    if (!winner || len > winner.path.length || (len === winner.path.length && r.type === 'allow')) winner = r;
  }
  if (!winner) return { allowed: true, by: null };
  return { allowed: winner.type === 'allow', by: winner };
}

// Contradictory duplicate groups are legal but fragile: compliant crawlers merge them and
// let allow win, non-compliant ones may take the first they see. Worth flagging, not fixing
// for the user — their lines are theirs (invariant 6).
export function contradictoryGroups(robots, uas) {
  const out = [];
  for (const ua of uas) {
    const groups = matchingGroups(robots, ua);
    if (groups.length < 2) continue;
    const kinds = new Set();
    for (const g of groups) for (const r of g.rules) if (!r.other && r.path === '/') kinds.add(r.type);
    if (kinds.size > 1) out.push(ua);
  }
  return out;
}

// Is the whole site blocked? (CORE-02)
export function blocksEverything(robots, ua = '*') {
  // "Blocked" means the merged result blocks it, not merely that a Disallow line exists.
  return rulesFor(robots, ua).some((r) => r.type === 'disallow' && r.path === '/')
    && !isAllowed(robots, ua, '/').allowed;
}

export function hasExplicitGroup(robots, ua) {
  const target = String(ua).toLowerCase();
  return robots.groups.some((g) => g.agents.some((a) => a !== '*' && (target === a || target.startsWith(a))));
}
