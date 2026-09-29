import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, readPositionals } from '../skill/scripts/lib/args.mjs';

// A slash command passes through whatever the user typed. These are the shapes people
// type without reading any documentation, so all of them have to land somewhere sensible.
const read = (argv) => {
  const args = parseArgs(argv);
  return { unknown: readPositionals(args), args };
};

test('bare invocation asks for nothing', () => {
  const { args, unknown } = read([]);
  assert.equal(args.only, undefined);
  assert.equal(args.url, undefined);
  assert.deepEqual(unknown, []);
});

test('seo and geo select a half, case-insensitively', () => {
  assert.equal(read(['seo']).args.only, 'seo');
  assert.equal(read(['GEO']).args.only, 'geo');
});

test('a bare host becomes an https url', () => {
  assert.equal(read(['example.com']).args.url, 'https://example.com');
  assert.equal(read(['example.co.kr']).args.url, 'https://example.co.kr');
});

test('an explicit url is left alone, scheme and path included', () => {
  assert.equal(read(['http://example.com/a/b']).args.url, 'http://example.com/a/b');
});

test('positionals combine with flags', () => {
  const { args } = read(['geo', '--verbose', 'example.com']);
  assert.equal(args.only, 'geo');
  assert.equal(args.url, 'https://example.com');
  assert.equal(args.verbose, true);
});

test('a word we do not understand is reported, never silently dropped', () => {
  const { unknown, args } = read(['everything']);
  assert.deepEqual(unknown, ['everything']);
  assert.equal(args.only, undefined);
});

test('an explicit flag is not overwritten by a positional of the same kind', () => {
  const { args } = read(['--url', 'https://flag.example', 'other.example', '--only', 'seo', 'geo']);
  assert.equal(args.url, 'https://flag.example');
  assert.equal(args.only, 'seo');
});
