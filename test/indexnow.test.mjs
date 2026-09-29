// A live 422 from Naver looked exactly like a working integration in the summary line.
// The payload shape is now pinned by a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payload, chunk, ENDPOINTS, BATCH } from '../skill/scripts/lib/indexnow.mjs';

test('the payload carries no keyLocation — Naver 422s on it', () => {
  const p = payload({ host: 'a.kr', key: 'k', urls: ['https://a.kr/'] });
  assert.deepEqual(Object.keys(p).sort(), ['host', 'key', 'urlList']);
  assert.equal('keyLocation' in p, false);
});

test('both endpoints are addressed, and Google is not among them', () => {
  assert.deepEqual(ENDPOINTS.map((e) => e.name), ['api.indexnow.org', 'searchadvisor.naver.com']);
  assert.equal(ENDPOINTS.some((e) => /google/i.test(e.url)), false);
});

test('submissions are split at the protocol limit', () => {
  assert.equal(BATCH, 10000);
  const urls = Array.from({ length: 10001 }, (_, i) => `https://a.kr/${i}`);
  const parts = chunk(urls);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].length, 10000);
  assert.equal(parts[1].length, 1);
});
