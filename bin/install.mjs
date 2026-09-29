#!/usr/bin/env node
// Installer. It detects harnesses but the user does the checking (invariant 10).
// Target: 2 questions, under a minute. Writes only where the user chose.
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, symlinkSync, lstatSync, rmSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
const SRC_SKILL = join(HERE, '..', 'skill');
const SRC_TPL = join(HERE, '..', 'templates', 'commands');
const NAME = 'spbseo';
const HOME = homedir();
const CODEX_HOME = process.env.CODEX_HOME || join(HOME, '.codex');
const CWD = process.cwd();

const AGENTS = [
  {
    key: 'claude', label: 'Claude Code',
    detect: () => existsSync(join(HOME, '.claude')) || existsSync(join(CWD, '.claude')),
    skill: (s) => (s === 'global' ? join(HOME, '.claude', 'skills', NAME) : join(CWD, '.claude', 'skills', NAME)),
    command: null,  // the skill name itself becomes /spbseo
    hint: 'the skill name is the command — no command file needed',
    invoke: '/spbseo   (restart Claude Code once so it picks the skill up)',
  },
  {
    key: 'codex', label: 'Codex CLI',
    detect: () => existsSync(join(HOME, '.codex')),
    // Codex reads .agents/skills in the project and $CODEX_HOME/skills globally. It used to
    // take a command file in ~/.codex/prompts; that directory is gone as of 0.159, and
    // Codex has no per-skill slash command at all — the model picks a skill by description.
    skill: (s) => (s === 'global' ? join(CODEX_HOME, 'skills', NAME) : join(CWD, '.agents', 'skills', NAME)),
    command: null,
    hint: 'discovered from .agents/skills — Codex has no per-skill slash command',
    invoke: 'ask for it in plain words ("check this site\'s SEO") · /skills lists it',
  },
  {
    key: 'gemini', label: 'Gemini CLI',
    detect: () => existsSync(join(HOME, '.gemini')) || existsSync(join(CWD, '.gemini')),
    skill: (s) => (s === 'global' ? join(HOME, '.agents', 'skills', NAME) : join(CWD, '.agents', 'skills', NAME)),
    // Gemini reads both: .agents/skills for the skill, .gemini/commands for the command.
    // Its user-skill alias really is ~/.agents/skills, not only ~/.gemini/skills.
    command: (s) => (s === 'global' ? join(HOME, '.gemini', 'commands', `${NAME}.toml`) : join(CWD, '.gemini', 'commands', `${NAME}.toml`)),
    template: 'gemini.toml',
    invoke: '/spbseo   (or /skills reload, then just ask)',
  },
  {
    key: 'antigravity', label: 'Antigravity',
    detect: () => existsSync(join(HOME, '.gemini', 'antigravity')) || existsSync(join(HOME, '.gemini', 'antigravity-cli')) || existsSync(join(CWD, '.agent')),
    skill: (s) => (s === 'global' ? join(HOME, '.agents', 'skills', NAME) : join(CWD, '.agents', 'skills', NAME)),
    command: () => join(CWD, '.agent', 'workflows', `${NAME}.md`),
    template: 'antigravity.md',
    invoke: '/spbseo',
  },
  {
    key: 'shared', label: 'Shared (.agents/skills — Cursor, Kimi Code, Cline, Warp, Zed …)',
    detect: () => existsSync(join(CWD, '.agents')) || existsSync(join(HOME, '.agents')),
    skill: (s) => (s === 'global' ? join(HOME, '.agents', 'skills', NAME) : join(CWD, '.agents', 'skills', NAME)),
    command: null,
    hint: 'several harnesses read this path',
    invoke: 'however that harness invokes skills',
  },
];

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i > -1 ? (args[i + 1] || true) : (args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? null); };
const YES = args.includes('--yes') || args.includes('-y');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`spb-seo-geo ${PKG.version} — install

  npx spb-seo-geo                                    interactive (2 questions)
  npx spb-seo-geo --agent claude,codex --scope project --yes
  npx spb-seo-geo --list-agents

Options
  --agent  claude|codex|gemini|antigravity|shared  (comma separated)
  --scope  project (default) | global
  --yes    skip the questions

It detects installed harnesses but never installs everywhere on its own.
`);
  process.exit(0);
}

if (args.includes('--list-agents')) {
  for (const a of AGENTS) console.log(`${a.detect() ? '●' : '○'} ${a.key.padEnd(12)} ${a.label}`);
  process.exit(0);
}

const detected = AGENTS.filter((a) => a.detect());
let chosen = [];
let scope = flag('scope') === 'global' ? 'global' : 'project';

const fromFlag = flag('agent');
if (fromFlag && typeof fromFlag === 'string') {
  const keys = fromFlag.split(',').map((s) => s.trim());
  chosen = AGENTS.filter((a) => keys.includes(a.key));
  if (!chosen.length) { console.error(`unknown harness: ${fromFlag}`); process.exit(1); }
} else if (YES) {
  console.error('Pass --agent together with --yes — we never install where you did not ask.');
  process.exit(1);
} else if (!process.stdin.isTTY) {
  console.log(`spb-seo-geo ${PKG.version}
Non-interactive environment — nothing was installed.

  npx spb-seo-geo --agent claude --scope project --yes

Detected harnesses: ${detected.map((a) => a.key).join(', ') || 'none'}`);
  process.exit(0);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  console.error(`\nspb-seo-geo ${PKG.version} install\n`);
  console.error(`Detected: ${detected.length ? detected.map((a) => a.label).join(' · ') : 'none'}\n`);
  const list = detected.length ? detected : AGENTS;
  list.forEach((a, i) => console.error(`  ${i + 1}) ${a.label}${a.hint ? `   — ${a.hint}` : ''}`));
  console.error('');
  const pick = (await rl.question('Where should it go? Numbers, comma separated (enter = 1): ')).trim() || '1';
  chosen = pick.split(',').map((n) => list[Number(n.trim()) - 1]).filter(Boolean);
  if (!chosen.length) { console.error('Nothing selected — nothing installed.'); process.exit(1); }
  const sc = (await rl.question('Scope?  1) this project (default)   2) global : ')).trim();
  scope = sc === '2' ? 'global' : 'project';
  await rl.close();
}

// Keep exactly one real copy of the skill (invariant 11-a). Prefer the shared path as the real one.
const targets = [...new Set(chosen.map((a) => a.skill(scope)))];
const primary = targets.find((t) => t.includes(`.agents${sep()}skills`)) || targets[0];
const made = [];

mkdirSync(dirname(primary), { recursive: true });
if (existsSync(primary)) rmSync(primary, { recursive: true, force: true });
cpSync(SRC_SKILL, primary, { recursive: true });
made.push([primary, 'skill + scripts + rules + references']);

for (const t of targets) {
  if (t === primary) continue;
  mkdirSync(dirname(t), { recursive: true });
  try { if (existsSync(t) || isLink(t)) rmSync(t, { recursive: true, force: true }); } catch {}
  try {
    symlinkSync(relative(dirname(t), primary), t, 'dir');
    made.push([t, `link → ${short(primary)}`]);
  } catch {
    cpSync(SRC_SKILL, t, { recursive: true });
    made.push([t, 'copy (symlink failed)']);
  }
}

const globalPointers = [];
for (const a of chosen) {
  if (!a.command) continue;
  const file = a.command(scope);
  const tpl = readFileSync(join(SRC_TPL, a.template), 'utf8');
  const skillDir = a.skill(scope) === primary ? primary : a.skill(scope);
  // A command file outside the project cannot use a project-relative path: open another
  // repo and /spbseo would point at nothing. Relative only when both live in the project.
  const fileIsInProject = file.startsWith(CWD);
  const body = tpl.replaceAll('{{SKILL_DIR}}', fileIsInProject ? portable(skillDir) : skillDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  made.push([file, fileIsInProject ? '/spbseo command' : '/spbseo command (global)']);
  if (!fileIsInProject && scope === 'project') globalPointers.push([a.label, file]);
}

console.log('');
for (const [p, note] of made) console.log(`✅ ${short(p)}${' '.repeat(Math.max(1, 44 - short(p).length))}${note}`);
const runLines = chosen.map((a) => `${a.label}:`.padEnd(15) + (a.invoke || '/spbseo'));
console.log(`
   run:     ${runLines.join('\n            ')}
   update:  npx spb-seo-geo@latest
   scope:   ${scope === 'global' ? 'global' : 'this project'} · nothing was written for harnesses you did not pick`);

if (globalPointers.length) {
  console.log(`
   note:    ${globalPointers.map(([l]) => l).join(', ')} keeps its command file in your home
            directory, so /spbseo there points at *this* project wherever you run it.
            Install with --scope global, or re-run here per project.`);
}

if (scope === 'project') {
  console.log(`
   git:     commit .spb-seo-geo.json (it holds your answers), and add the skill folder
            to .gitignore unless you want it vendored for your team`);
}

function sep() { return process.platform === 'win32' ? '\\' : '/'; }
function short(p) { return p.startsWith(CWD) ? relative(CWD, p) : p.replace(HOME, '~'); }
function isLink(p) { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } }
// Project scope uses a relative path so it survives being cloned elsewhere
function portable(p) { return p.startsWith(CWD) ? '.' + sep() + relative(CWD, p) : p.replace(HOME, '~'); }
