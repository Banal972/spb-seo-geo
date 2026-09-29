import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPhase1, marketPhase2, marketSentence } from '../skill/scripts/lib/market.mjs';
import { parseHtml, hangulRatio } from '../skill/scripts/lib/html.mjs';

const page = (html) => ({ parsed: parseHtml(html) });

test('flag and saved config win and are final', () => {
  assert.equal(marketPhase1({ option: 'global', url: 'https://x.kr' }).market, 'global');
  assert.equal(marketPhase1({ saved: 'kr', url: 'https://x.com' }).market, 'kr');
  assert.equal(marketPhase1({ option: 'kr', url: 'https://x.com' }).final, true);
});

test('.kr is caught in phase 1', () => {
  assert.equal(marketPhase1({ url: 'https://a.co.kr' }).market, 'kr');
  assert.equal(marketPhase1({ url: 'https://a.com' }).market, 'undecided');
});

test('naver-site-verification is a declaration, so even an English .com is kr', () => {
  const p1 = marketPhase1({ url: 'https://a.com' });
  const m = marketPhase2(p1, [page('<html lang="en"><head><meta name="naver-site-verification" content="abc"></head><body>Hello world</body></html>')]);
  assert.equal(m.market, 'kr');
  assert.ok(m.basis.some((b) => b.includes('naver-site-verification')));
});

test('Korean body text means kr even with lang=en (prevents the costliest misjudgment)', () => {
  const body = '<body>' + '검색 노출 최적화를 위한 안내 문서입니다. '.repeat(20) + '</body>';
  const m = marketPhase2(marketPhase1({ url: 'https://a.com' }), [page(`<html lang="en">${body}</html>`)]);
  assert.equal(m.market, 'kr');
  assert.ok(m.basis.some((b) => b.endsWith('Hangul')));
});

test('no signal means undecided, not global (absence is not evidence)', () => {
  const m = marketPhase2(marketPhase1({ url: 'https://a.com' }), [page('<html lang="en"><body>Hello world, this is a test page.</body></html>')]);
  assert.equal(m.market, 'undecided');
  assert.match(marketSentence(m)[0], /were not evaluated/);
});

test('each signal kind is counted once, not per page', () => {
  const p = page('<html lang="ko"><body>' + '한국어 본문 '.repeat(30) + '</body></html>');
  const m = marketPhase2(marketPhase1({ url: 'https://a.com' }), [p, p, p, p]);
  assert.equal(m.basis.filter((b) => b.endsWith('Hangul')).length, 1);
  assert.equal(m.basis.filter((b) => b.startsWith('lang=')).length, 1);
});

test('Hangul ratio calculation', () => {
  assert.ok(hangulRatio('한글만 있음') > 0.9);
  assert.equal(hangulRatio('abc 123'), 0);
  assert.ok(Math.abs(hangulRatio('가나abcd') - 0.333) < 0.01);
});
