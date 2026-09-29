// A question without its consequences is not a question. The user asked "what happens if I
// allow training?" and "what is llms.txt good for?" — both should have come with the ask.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const run = (dir) => execFileSync(process.execPath, [join(HERE, '..', 'skill', 'scripts', 'intake.mjs'), '--dir', dir], { encoding: 'utf8' });
const fresh = () => {
  const d = mkdtempSync(join(tmpdir(), 'spbseo-choice-'));
  writeFileSync(join(d, 'package.json'), '{"name":"x"}');
  return d;
};
const out = run(fresh());

test('every open question carries its tradeoff', () => {
  for (const q of ['AI training policy', 'verification tokens', 'access log', 'optional files', 'Naver (Korea)', 'Yahoo! JAPAN']) {
    const i = out.indexOf(q);
    assert.ok(i > -1, `${q} asked`);
    const block = out.slice(i, out.indexOf('  ?', i + 5) > -1 ? out.indexOf('  ?', i + 5) : undefined);
    assert.match(block, /\n {10}\S/, `${q} must be followed by an explanation`);
  }
});

test('the training policy states what each option buys and costs, and marks the unverified part', () => {
  assert.match(out, /open .*training allowed/i);
  assert.match(out, /grade: low, unverified/, 'the "model remembers the brand" benefit is a bet, not a mechanism');
  assert.match(out, /cite-only .*citation kept/i);
  assert.match(out, /closed .*disappear from AI answers/i);
  assert.match(out, /Search ranking is identical in all three/, 'the thing people fear losing is unaffected');
});

test('llms.txt is presented with both sides, not sold', () => {
  assert.match(out, /helps coding agents read your docs/);
  assert.match(out, /97% of llms\.txt files measured had zero traffic/);
  assert.match(out, /Google says it is unnecessary/);
});

test('RSS names the staleness cost, not just the benefit', () => {
  assert.match(out, /Naver still treats it as a first-class input/);
  assert.match(out, /goes stale unless your build regenerates it/);
});

test('the agent is told to give the cost with the question', () => {
  assert.match(out, /Give the tradeoff with the question/);
  assert.match(out, /references\/choices\.md/);
});

test('choices.md grades its claims like the rules do', () => {
  const md = readFileSync(join(HERE, '..', 'skill', 'references', 'choices.md'), 'utf8');
  for (const g of ['primary', 'secondary', 'low']) assert.match(md, new RegExp(g));
  assert.match(md, /Grade: low/, 'the training-memory benefit is explicitly unverified');
  assert.match(md, /Google does not participate/, 'IndexNow limits stated');
  assert.match(md, /Reversible\?/, 'the policy decision says how to undo it');
});
