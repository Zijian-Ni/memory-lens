import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inventory, scoreDecay, negationPolarity, detectContradiction } from '../src/index.js';
import { writeSyntheticMemory, rmrf } from './fixtures.js';

describe('decay scoring', () => {
  let dir;
  before(() => { dir = writeSyntheticMemory(); });
  after(() => { rmrf(dir); });

  it('ranks contradicted / duplicated / past-dated entries for review, never as a delete list', () => {
    const inv = inventory(dir);
    const decay = scoreDecay(inv.items, { now: '2026-08-17T00:00:00Z' });
    assert.ok(Array.isArray(decay.review));
    assert.ok(decay.review.length >= 1);
    // The public field is "review". There is no delete / remove list.
    assert.equal(decay.delete, undefined);
    assert.equal(decay.removals, undefined);

    const codes = new Set(decay.review.flatMap((r) => r.reasons.map((x) => x.code)));
    assert.ok(codes.has('contradicted') || codes.has('duplicateOf') || codes.has('pastDate'));

    const visa = decay.review.find((r) => /2024-11-02/.test(r.entry.body));
    assert.ok(visa, 'past-dated visa line should be on the review list');
    assert.ok(visa.reasons.some((x) => x.code === 'pastDate'));
  });

  it('negation polarity flips EN and ZH', () => {
    assert.equal(negationPolarity('Tests do not pass on Node 18.'), -1);
    assert.equal(negationPolarity('Tests pass on Node 18.'), 1);
    assert.equal(negationPolarity('测试没有通过。'), -1);
    assert.equal(negationPolarity('测试通过。'), 1);
  });

  it('detects a later numeric contradiction on overlapping text', () => {
    const older = { body: 'Disk F is at 62% used.' };
    const newer = { body: 'Disk F is at 96% used.' };
    const hits = detectContradiction(older, newer);
    assert.ok(hits.includes('number'), `expected number conflict, got ${hits}`);
  });
});
