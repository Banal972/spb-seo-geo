// Argument parsing and exit codes. No dependencies.
export const EXIT = { OK: 0, CRITICAL: 1, WARN: 2, ERROR: 3 };

const BOOL = new Set([
  'json', 'verbose', 'write', 'yes', 'force', 'with-llms-txt', 'help', 'dry-run', 'lint',
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

// stdout carries the report only; progress and warnings go to stderr (safe for pipes and agent capture)
export const log = (...a) => process.stderr.write(a.join(' ') + '\n');
export const out = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');

export function exitWith(counts) {
  if (counts.fail > 0) return EXIT.CRITICAL;
  if (counts.warn > 0) return EXIT.WARN;
  return EXIT.OK;
}

export const isTTY = () => process.stdout.isTTY === true;
