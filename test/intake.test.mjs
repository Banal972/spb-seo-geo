import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INTAKE = join(HERE, '..', 'skill', 'scripts', 'intake.mjs');
const run = (dir) => execFileSync(process.execPath, [INTAKE, '--dir', dir], { encoding: 'utf8' });
const proj = (files = {}) => {
  const d = mkdtempSync(join(tmpdir(), 'spbseo-intake-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(d, p, '..'), { recursive: true });
    writeFileSync(join(d, p), body);
  }
  return d;
};

test('a fresh project has every question outstanding, in order', () => {
  const out = run(proj({ 'package.json': '{"name":"x"}' }));
  assert.match(out, /7 still to ask/);
  const order = ['site URL', 'Naver', 'Yahoo', 'AI training policy', 'verification tokens', 'access log', 'optional files'];
  let at = -1;
  for (const label of order) {
    const i = out.indexOf(label);
    assert.ok(i > at, `${label} must come after the previous question`);
    at = i;
  }
  assert.match(out, /ONE question at a time/);
});

test('a detected URL turns the first question into a confirmation', () => {
  const out = run(proj({ 'package.json': '{"homepage":"https://aaa.com"}' }));
  assert.match(out, /detected in package\.json homepage/);
  assert.match(out, /Is https:\/\/aaa\.com the right address\?/);
});

test('each engine is one question — never inferred from Korean content', () => {
  const out = run(proj({ 'package.json': '{"homepage":"https://aaa.co.kr"}', 'index.html': '<html lang="ko"><body>한국어</body></html>' }));
  assert.match(out, /Do you want to cover Naver \(Korea\)\?/);
  assert.match(out, /Do you want to cover Yahoo! JAPAN \(Japan\)\?/);
});

test('answers already saved are not asked again', () => {
  const d = proj({
    'package.json': '{"name":"x"}',
    '.spb-seo-geo.json': JSON.stringify({ url: 'https://aaa.com', engines: 'naver', aiPolicy: 'cite-only', accessLog: 'a.log', withRss: true, tokens: { google: 'g', bing: 'b', naver: 'n' } }),
  });
  const out = run(d);
  assert.match(out, /Intake — complete/);
  assert.match(out, /Nothing left to ask/);
  assert.doesNotMatch(out, /ask:/);
});

test('the suggested setup command carries one --engines, not one per engine', () => {
  const out = run(proj({ 'package.json': '{"name":"x"}' }));
  const cmd = out.split('\n').find((l) => l.includes('setup.mjs'));
  assert.equal((cmd.match(/--engines/g) || []).length, 1);
  assert.match(cmd, /--engines <naver,yahoo\|none>/);
});

test('an access log in the repo is offered rather than asked about blindly', () => {
  const out = run(proj({ 'package.json': '{"name":"x"}', 'access.log': 'x' }));
  assert.match(out, /found in the repo/);
  assert.match(out, /Use .*access\.log to measure AI crawler activity\?/);
});
