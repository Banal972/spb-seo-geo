// Rules must not claim more than their evidence. Google is on record that h1 count does not
// matter, so flagging it would be the same folklore this project exists to avoid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkers } from '../skill/scripts/lib/checkers.mjs';
import { parseHtml } from '../skill/scripts/lib/html.mjs';
import { loadCatalog } from '../skill/scripts/lib/rules.mjs';

const facts = (html) => ({ remote: true, samples: [], home: { url: 'https://a.kr/', parsed: Object.assign(parseHtml(html), { url: 'https://a.kr/' }) } });

test('several h1 elements are not a finding', () => {
  const html = '<html><body><h1>A</h1><h2>b</h2><h1>B</h1><h2>c</h2></body></html>';
  assert.equal(checkers.headingStructure(facts(html)).ok, true);
});

test('no h1 at all is not a finding either', () => {
  assert.equal(checkers.headingStructure(facts('<html><body><h2>a</h2><h3>b</h3></body></html>')).ok, true);
});

test('a skipped level is reported, with where it happened', () => {
  const res = checkers.headingStructure(facts('<html><body><h1>Title</h1><h3>Jumped</h3></body></html>'));
  assert.equal(res.ok, false);
  assert.match(res.detail, /jumps to h3 \("Jumped"\)/);
});

test('the rule is graded to match its evidence, not its confidence', () => {
  const r = loadCatalog().rules.find((x) => x.id === 'GEO-11');
  assert.equal(r.severity, 'info', 'not a warning — heading order is not a ranking lever');
  assert.equal(r.grade, 'low');
  assert.match(r.action, /does not affect ranking/);
  assert.match(r.action, /rich-text editor/, 'the CMS case gets the actionable fix');
  assert.match(r.evidence, /w3\.org\/WAI/, 'the honest citation is the accessibility one');
});
