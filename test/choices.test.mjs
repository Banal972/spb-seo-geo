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
  for (const q of ['AI training policy', 'verification tokens', 'access log', 'optional files']) {
    const i = out.indexOf(q);
    assert.ok(i > -1, `${q} asked`);
    const block = out.slice(i, out.indexOf('  ?', i + 5) > -1 ? out.indexOf('  ?', i + 5) : undefined);
    assert.match(block, /\n {10}\S/, `${q} must be followed by an explanation`);
  }
});

test('the training policy is asked in plain words, with both costs and the unverified part', () => {
  assert.match(out, /Is it fine for AI companies to learn from your content/, 'no jargon in the question itself');
  assert.match(out, /nobody can prove that per site/, 'the "model remembers your brand" benefit is a bet, not a mechanism');
  assert.match(out, /can still quote you and link to you/);
  assert.match(out, /disappears from them/, 'the third option is named but not pushed');
  assert.match(out, /ranking is exactly the same/, 'the thing people fear losing is unaffected');
});

test('llms.txt is presented with both sides, not sold', () => {
  assert.match(out, /only helps if you publish developer documentation/);
  assert.match(out, /97% of measured files saw zero traffic/);
  assert.match(out, /Google says it is unnecessary/);
});

test('RSS is framed by whether the site publishes, and names the upkeep', () => {
  assert.match(out, /publish posts regularly/, 'asked by what the site is, not by what RSS is');
  assert.match(out, /Naver still reads them/);
  assert.match(out, /your build has to regenerate it/);
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
