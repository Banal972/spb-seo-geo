import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enginesPhase1, enginesPhase2, enginesSentence, OPTIONAL_ENGINES } from '../skill/scripts/lib/engines.mjs';
import { parseHtml } from '../skill/scripts/lib/html.mjs';

const page = (html) => ({ parsed: parseHtml(html) });
const korean = '<html lang="ko"><body>' + '한국어 본문입니다. '.repeat(30) + '</body></html>';

test('every optional engine is named even when the signals point elsewhere', () => {
  // A .kr site may still be going after Japan — signals are language, not intent.
  const m = enginesPhase2(enginesPhase1({ url: 'https://a.co.kr' }), [page(korean)]);
  const text = enginesSentence(m).join('\n');
  for (const e of OPTIONAL_ENGINES) assert.match(text, new RegExp(e, 'i'), `${e} must stay discoverable`);
  assert.match(text, /Naver \(Korea\) ←/, 'the suggested one is marked');
  assert.match(text, /language, not intent/);
});

test('an explicit choice still names what was left out', () => {
  const m = enginesPhase1({ option: 'naver', url: 'https://a.co.kr' });
  assert.match(enginesSentence(m).join('\n'), /also available: yahoo/);
});

test('choosing none is stated plainly and still leaves a way back', () => {
  const t = enginesSentence(enginesPhase1({ option: 'none', url: 'https://a.co.kr' })).join('\n');
  assert.match(t, /Optional engines: none/);
  assert.match(t, /also available: naver, yahoo/);
});

test('with no signal at all, the engines are still offered', () => {
  const m = enginesPhase2(enginesPhase1({ url: 'https://a.com' }), [page('<html lang="en"><body>Plain english.</body></html>')]);
  const t = enginesSentence(m).join('\n');
  assert.match(t, /naver,yahoo/);
  assert.doesNotMatch(t, /←/, 'nothing is marked as suggested');
});
