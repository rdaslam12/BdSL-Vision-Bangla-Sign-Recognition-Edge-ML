// Run on Node 22.6+ with: node --experimental-strip-types --test tests/practice.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancePractice } from '../src/lib/practice.ts';
const initial = { count: 0, feedback: 'waiting' };
const detection = (name = 'ভালো', confidence = 0.8) => ({ name, confidence, x1: 0, y1: 0, x2: 1, y2: 1 });
const next = (state, detections = [detection()]) => advancePractice(state, detections, 'ভালো');
test('requires three consecutive real matches', () => {
  const first = next(initial); assert.equal(first.feedback, 'matching');
  const second = next(first); assert.equal(second.feedback, 'matching');
  assert.deepEqual(next(second), { count: 3, feedback: 'success' });
});
test('a mismatch breaks the streak and removes success', () => {
  assert.deepEqual(next({count:3,feedback:'success'},[detection('কে')]), {count:0,feedback:'mismatch'});
});
test('no detections breaks the streak', () => {
  assert.deepEqual(next(next(initial), []), {count:0,feedback:'empty'});
});
test('confidence threshold is inclusive at 65 percent', () => {
  assert.equal(next(initial,[detection('ভালো',0.65)]).count,1);
  assert.deepEqual(next(next(initial),[detection('ভালো',0.649)]),{count:0,feedback:'uncertain'});
});
test('non-finite confidence never succeeds', () => {
  for (const score of [NaN,Infinity,-Infinity]) assert.equal(next(initial,[detection('ভালো',score)]).count,0);
});
test('a lower-ranked target does not win over a different top detection', () => {
  assert.equal(next(initial,[detection('ভালো',0.7),detection('কে',0.9)]).feedback,'mismatch');
});
test('success count is capped and recovery starts a fresh streak', () => {
  assert.equal(next({count:3,feedback:'success'}).count,3);
  assert.equal(next(next({count:3,feedback:'success'},[])).count,1);
});

test('manifest maps all 18 illustrations to exact class labels', async () => {
  const { readFile } = await import('node:fs/promises');
  const { SIGN_LABELS, SIGN_SAMPLES } = await import('../src/data/signs.ts');
  const classes = (await readFile(new URL('../../classes.txt', import.meta.url), 'utf8')).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  assert.deepEqual([...SIGN_LABELS], classes);
  const manifest = JSON.parse(await readFile(new URL('../../signs-manifest.example.json', import.meta.url), 'utf8'));
  assert.equal(SIGN_SAMPLES.length, 18);
  assert.equal(new Set(SIGN_SAMPLES.map(sample => sample.label)).size, 18);
  for (const entry of manifest) {
    const sample = SIGN_SAMPLES.find(sample => sample.id === entry.id);
    assert.equal(sample.label, entry.labelBn);
    assert.equal(sample.english, entry.labelEn);
    assert.equal(sample.image, entry.illustration);
    assert.equal(sample.verifiedBdslGesture, false);
    const bytes = await readFile(new URL(`../public${sample.image}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  assert.ok(SIGN_SAMPLES.every(sample => classes.includes(sample.label)));
});
