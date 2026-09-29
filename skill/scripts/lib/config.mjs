// Stores only what a human answered. Never page content, never credentials.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const CONFIG_NAME = '.spb-seo-geo.json';

// Guess the repo root: the topmost directory holding .git or package.json
export function findRoot(start = process.cwd()) {
  let dir = start;
  let best = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, '.git'))) return dir;
    if (existsSync(join(dir, 'package.json'))) best = dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return best;
}

export function loadConfig(root = findRoot()) {
  const p = join(root, CONFIG_NAME);
  if (!existsSync(p)) return { _path: p, _exists: false };
  try {
    return { ...JSON.parse(readFileSync(p, 'utf8')), _path: p, _exists: true };
  } catch {
    return { _path: p, _exists: false, _broken: true };
  }
}

export function saveConfig(patch, root = findRoot()) {
  const cur = loadConfig(root);
  const { _path, _exists, _broken, ...keep } = cur;
  const next = { ...keep, ...patch };
  writeFileSync(_path, JSON.stringify(next, null, 2) + '\n');
  return _path;
}
