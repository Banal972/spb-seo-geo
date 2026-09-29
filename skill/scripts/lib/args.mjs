// Argument parsing and exit codes. No dependencies.
export const EXIT = { OK: 0, CRITICAL: 1, WARN: 2, ERROR: 3 };

const BOOL = new Set([
  'json', 'verbose', 'write', 'yes', 'force', 'with-llms-txt', 'with-rss', 'help', 'dry-run', 'lint', 'save',
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    if (BOOL.has(key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

// A slash command hands us whatever the user typed after it. Accepting the two shapes
// people actually type — `/spbseo geo` and `/spbseo example.com` — means they never have
// to learn a flag, and an unrecognised word is an error rather than a silent full run.
export function readPositionals(args) {
  const rest = [];
  for (const raw of args._) {
    const v = String(raw).trim();
    if (!v) continue;
    const low = v.toLowerCase();
    // An explicit flag always wins: it was typed deliberately.
    if (low === 'seo' || low === 'geo') { args.only ??= low; continue; }
    if (/^(https?:\/\/|[\w-]+(\.[\w-]+)+)/.test(v)) { args.url ??= /^https?:\/\//.test(v) ? v : `https://${v}`; continue; }
    rest.push(v);
  }
  args._ = [];
  return rest;
}

// stdout carries the report only; progress and warnings go to stderr (safe for pipes and agent capture)
export const log = (...a) => process.stderr.write(a.join(' ') + '\n');
export const out = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');

export function exitWith(counts) {
  if (counts.fail > 0) return EXIT.CRITICAL;
  if (counts.warn > 0) return EXIT.WARN;
  return EXIT.OK;
}

export const isTTY = () => process.stdout.isTTY === true;
