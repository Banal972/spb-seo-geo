import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enginesPhase1, enginesPhase2, enginesSentence, parseEngines } from '../skill/scripts/lib/engines.mjs';
import { parseHtml, scriptRatios } from '../skill/scripts/lib/html.mjs';

const page = (html) => ({ parsed: parseHtml(html) });
const detect = (url, html) => enginesPhase2(enginesPhase1({ url }), html ? [page(html)] : []);

test('an explicit choice or a saved one is authoritative', () => {
  assert.deepEqual(enginesPhase1({ option: 'naver', url: 'https://x.com' }).engines, ['naver']);
  assert.deepEqual(enginesPhase1({ saved: 'naver,yahoo', url: 'https://x.com' }).engines, ['naver', 'yahoo']);
  assert.equal(enginesPhase1({ option: 'naver', url: 'https://x.com' }).answered, true);
  assert.deepEqual(enginesPhase1({ option: 'none', url: 'https://x.kr' }).engines, [], 'none wins over any signal');
});

test('parseEngines normalises input', () => {
  assert.deepEqual(parseEngines('naver'), ['naver']);
  assert.deepEqual(parseEngines(' YAHOO , naver '), ['yahoo', 'naver']);
  assert.deepEqual(parseEngines('none'), []);
  assert.equal(parseEngines('auto'), null);
  assert.equal(parseEngines('bing'), null, 'bing is never optional');
});

test('signals are a suggestion, never a gate', () => {
  const m = detect('https://a.co.kr', '<html lang="ko"><body>안녕하세요 검색 노출 안내</body></html>');
  assert.equal(m.answered, false);
  assert.deepEqual(m.engines, [], 'nothing is selected on a guess');
  assert.ok(m.suggested.naver);
  assert.match(enginesSentence(m).join('\n'), /Signals suggest/);
});

test('Naver is suggested from Korean content even when lang says otherwise', () => {
  const body = '<body>' + '검색 노출 최적화를 위한 안내 문서입니다. '.repeat(20) + '</body>';
  const m = detect('https://a.com', `<html lang="en">${body}</html>`);
  assert.ok(m.suggested.naver.some((b) => b.endsWith('Hangul')));
  assert.equal(m.suggested.yahoo, undefined);
});

test('Yahoo is suggested from kana, and Chinese does not trigger it', () => {
  const ja = detect('https://a.com', '<html lang="ja"><body>' + '検索エンジン最適化のガイドです。'.repeat(10) + '</body></html>');
  assert.ok(ja.suggested.yahoo);
  const zh = detect('https://a.com', '<html lang="zh"><body>' + '搜索引擎优化指南内容说明。'.repeat(10) + '</body></html>');
  assert.equal(zh.suggested.yahoo, undefined, 'Chinese must not be read as Japanese');
});

test('a naver-site-verification tag is a declaration, not a guess', () => {
  const m = detect('https://a.com', '<html lang="en"><head><meta name="naver-site-verification" content="abc"></head><body>Hello</body></html>');
  assert.ok(m.suggested.naver.includes('naver-site-verification tag'));
});

test('each signal kind is listed once, not per page', () => {
  const p = page('<html lang="ko"><body>' + '한국어 본문 '.repeat(30) + '</body></html>');
  const m = enginesPhase2(enginesPhase1({ url: 'https://a.com' }), [p, p, p, p]);
  assert.equal(m.suggested.naver.filter((b) => b.endsWith('Hangul')).length, 1);
  assert.equal(m.suggested.naver.filter((b) => b.startsWith('lang=')).length, 1);
});

test('script ratios separate Korean, Japanese, Chinese and latin', () => {
  assert.ok(scriptRatios('한글만 있음').hangul > 0.9);
  assert.ok(scriptRatios('ひらがなとカタカナ').kana > 0.9);
  assert.equal(scriptRatios('搜索引擎优化').kana, 0);
  assert.equal(scriptRatios('latin only').hangul, 0);
});

test('choosing none says so plainly; no signal says nothing at all', () => {
  assert.match(enginesSentence(enginesPhase1({ option: 'none', url: 'https://a.kr' })).join(''), /none selected/);
  const quiet = detect('https://a.com', '<html lang="en"><body>A plain english page.</body></html>');
  assert.deepEqual(enginesSentence(quiet), []);
});
