// The token budget is the product's own promise. It only holds if something checks it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..', 'skill');
const md = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
const fmEnd = md.indexOf('---', 4);
const approxTokens = (s) => Math.round(s.length / 4);

test('frontmatter stays inside the advertised discovery cost', () => {
  assert.ok(approxTokens(md.slice(0, fmEnd)) <= 100, 'name + description must stay ~100 tokens');
});

test('the body stays inside the L1 budget', () => {
  const body = approxTokens(md.slice(fmEnd));
  assert.ok(body <= 1200, `SKILL.md body is ~${body} tokens; move detail into references/ instead of trimming words`);
});

test('every referenced file exists', () => {
  const files = new Set(readdirSync(join(SKILL, 'references')));
  for (const m of md.matchAll(/`([a-z]+)\.md`/g)) {
    if (m[1] === 'SKILL') continue;
    assert.ok(files.has(`${m[1]}.md`), `SKILL.md points at references/${m[1]}.md`);
  }
});

test('the skill forbids the things that would blow the budget', () => {
  for (const rule of [/fetch or read the site/i, /web-search for SEO/i, /enumerate passing rules/i]) {
    assert.match(md, rule);
  }
});
