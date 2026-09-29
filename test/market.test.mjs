import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketPhase1, marketPhase2, marketSentence, parseMarkets } from '../skill/scripts/lib/market.mjs';
import { parseHtml, scriptRatios } from '../skill/scripts/lib/html.mjs';

const page = (html) => ({ parsed: parseHtml(html) });
const detect = (url, html) => marketPhase2(marketPhase1({ url }), html ? [page(html)] : []);

test('an explicit flag or saved answer is authoritative', () => {
  assert.deepEqual(marketPhase1({ option: 'kr', url: 'https://x.com' }).markets, ['kr']);
  assert.deepEqual(marketPhase1({ saved: 'kr,jp', url: 'https://x.com' }).markets, ['kr', 'jp']);
  assert.equal(marketPhase1({ option: 'kr', url: 'https://x.com' }).answered, true);
  assert.deepEqual(marketPhase1({ option: 'global', url: 'https://x.kr' }).markets, [], 'global means no regional engines');
});

test('parseMarkets normalises input', () => {
  assert.deepEqual(parseMarkets('kr'), ['kr']);
  assert.deepEqual(parseMarkets(' JP , kr '), ['jp', 'kr']);
  assert.deepEqual(parseMarkets('global'), []);
  assert.equal(parseMarkets('auto'), null);
  assert.equal(parseMarkets('zz'), null);
});

test('signals are a nudge, never a gate', () => {
  const m = detect('https://a.co.kr', '<html lang="ko"><body>안녕하세요 검색 노출 안내</body></html>');
  assert.equal(m.answered, false);
  assert.deepEqual(m.markets, [], 'no answer yet');
  assert.ok(m.suggested.kr, 'but Korea is suggested');
  assert.match(marketSentence(m).join('\n'), /Regional signals/);
});

test('Korean suggestion survives lang=en — the costliest misjudgment', () => {
  const body = '<body>' + '검색 노출 최적화를 위한 안내 문서입니다. '.repeat(20) + '</body>';
  const m = detect('https://a.com', `<html lang="en">${body}</html>`);
  assert.ok(m.suggested.kr.some((b) => b.endsWith('Hangul')));
  assert.equal(m.suggested.jp, undefined);
});

test('Japanese is suggested from kana, and kanji alone does not trigger it', () => {
  const ja = detect('https://a.com', '<html lang="ja"><body>' + '検索エンジン最適化のガイドです。'.repeat(10) + '</body></html>');
  assert.ok(ja.suggested.jp, 'kana detected');
  const zh = detect('https://a.com', '<html lang="zh"><body>' + '搜索引擎优化指南内容说明。'.repeat(10) + '</body></html>');
  assert.equal(zh.suggested.jp, undefined, 'Chinese must not be read as Japanese');
});

test('a naver-site-verification tag is a declaration, not a guess', () => {
  const m = detect('https://a.com', '<html lang="en"><head><meta name="naver-site-verification" content="abc"></head><body>Hello</body></html>');
  assert.ok(m.suggested.kr.includes('naver-site-verification tag'));
});

test('each signal kind is listed once, not per page', () => {
  const p = page('<html lang="ko"><body>' + '한국어 본문 '.repeat(30) + '</body></html>');
  const m = marketPhase2(marketPhase1({ url: 'https://a.com' }), [p, p, p, p]);
  assert.equal(m.suggested.kr.filter((b) => b.endsWith('Hangul')).length, 1);
  assert.equal(m.suggested.kr.filter((b) => b.startsWith('lang=')).length, 1);
});

test('script ratios separate Korean, Japanese, Chinese and latin', () => {
  assert.ok(scriptRatios('한글만 있음').hangul > 0.9);
  assert.ok(scriptRatios('ひらがなとカタカナ').kana > 0.9);
  assert.equal(scriptRatios('搜索引擎优化').kana, 0);
  assert.equal(scriptRatios('latin only').hangul, 0);
});

test('an explicit global answer says the regional steps are hidden', () => {
  const m = { ...marketPhase1({ option: 'global', url: 'https://a.kr' }), suggested: { kr: ['a.kr domain'] } };
  assert.match(marketSentence(m).join('\n'), /hidden/);
});

test('no signal and no answer means no sentence at all — nothing to say', () => {
  const m = detect('https://a.com', '<html lang="en"><body>Hello world, a plain english page.</body></html>');
  assert.deepEqual(marketSentence(m), []);
});
