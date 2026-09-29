import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyze } from '../skill/scripts/lib/accesslog.mjs';
import { checkers } from '../skill/scripts/lib/checkers.mjs';
import { parseRobots } from '../skill/scripts/lib/robots.mjs';

const dir = mkdtempSync(join(tmpdir(), 'spbseo-'));
const write = (name, lines) => {
  const p = join(dir, name);
  writeFileSync(p, lines.join('\n') + '\n');
  return p;
};
const today = new Date().toISOString().slice(0, 10);
const [Y, M, D] = today.split('-');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(M) - 1];
const line = (ua, path = '/', when = `${D}/${MON}/${Y}`) =>
  `1.2.3.4 - - [${when}:10:00:01 +0000] "GET ${path} HTTP/1.1" 200 100 "-" "Mozilla/5.0 (compatible; ${ua})"`;

test('classifies bots into citation, training, user-triggered and search', () => {
  const p = write('a.log', [line('OAI-SearchBot/1.0'), line('GPTBot/1.0'), line('ChatGPT-User/1.0'), line('Googlebot/2.1')]);
  const r = analyze(p);
  assert.equal(r.ok, true);
  assert.equal(r.families.cite[0].ua, 'OAI-SearchBot');
  assert.equal(r.families.train[0].ua, 'GPTBot');
  assert.equal(r.families.user[0].ua, 'ChatGPT-User');
  assert.equal(r.families.search[0].ua, 'Googlebot');
});

test('counts hits, keeps the last date and samples paths', () => {
  const p = write('b.log', [line('PerplexityBot/1.0', '/a'), line('PerplexityBot/1.0', '/b'), line('PerplexityBot/1.0', '/a')]);
  const r = analyze(p).families.cite[0];
  assert.equal(r.hits, 3);
  assert.equal(r.last, today);
  assert.deepEqual(r.paths.sort(), ['/a', '/b']);
});

test('ignores entries older than the window', () => {
  const p = write('c.log', [line('OAI-SearchBot/1.0', '/', '01/Jan/2020')]);
  assert.equal(analyze(p, { window: 30 }).families.cite.length, 0);
  assert.equal(analyze(p, { window: 100000 }).families.cite.length, 1);
});

test('a missing file is an explained failure, not a crash', () => {
  const r = analyze(join(dir, 'nope.log'));
  assert.equal(r.ok, false);
  assert.match(r.error, /no such file/);
});

test('no citation fetch is a finding — being allowed is not being crawled', () => {
  const p = write('d.log', [line('Googlebot/2.1'), line('GPTBot/1.0')]);
  const facts = { remote: true, accessLog: analyze(p) };
  const res = checkers.aiCrawlerActivity(facts, { family: 'cite' });
  assert.equal(res.ok, false);
  assert.match(res.detail, /no citation crawler fetches/);
});

test('citation fetches pass and carry the evidence in the detail', () => {
  const p = write('e.log', [line('Claude-SearchBot/1.0'), line('Claude-SearchBot/1.0')]);
  const res = checkers.aiCrawlerActivity({ remote: true, accessLog: analyze(p) }, { family: 'cite' });
  assert.equal(res.ok, true);
  assert.match(res.detail, /Claude-SearchBot 2/);
});

test('without a log the verdict is unknown, never a pass', () => {
  const res = checkers.aiCrawlerActivity({ remote: true }, { family: 'cite' });
  assert.equal(res.ok, null);
  assert.match(res.detail, /--access-log/);
});

test('detects a crawler fetching while disallowed', () => {
  const p = write('f.log', [line('GPTBot/1.0')]);
  const facts = {
    remote: true, accessLog: analyze(p),
    robots: { res: { ok: true }, parsed: parseRobots('User-agent: GPTBot\nDisallow: /\n') },
  };
  const res = checkers.crawlerPolicyRespected(facts);
  assert.equal(res.ok, false);
  assert.match(res.detail, /GPTBot fetched 1x while disallowed/);
});
