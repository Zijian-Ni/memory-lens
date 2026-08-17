import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inventory, findDuplicates, shingles, jaccard } from '../src/index.js';
import { writeSyntheticMemory, rmrf } from './fixtures.js';

describe('duplicate clustering', () => {
  let dir;
  before(() => { dir = writeSyntheticMemory(); });
  after(() => { rmrf(dir); });

  it('clusters known near-duplicates of the extraPaths lesson', () => {
    const inv = inventory(dir);
    const { clusters } = findDuplicates(inv.items, { threshold: 0.45 });
    const hit = clusters.find((c) =>
      c.members.some((m) => /extraPaths|护栏|openclaw\.json/i.test(m.body)),
    );
    assert.ok(hit, 'expected a cluster around the extraPaths lesson');
    assert.ok(hit.size >= 3, `expected ≥3 copies, got ${hit.size}`);
    assert.ok(hit.representative.provenance);
    assert.ok(hit.candidates.length >= 2);
  });

  it('does not cluster genuinely distinct entries', () => {
    const inv = inventory(dir);
    const { clusters } = findDuplicates(inv.items, { threshold: 0.55 });
    const flattened = clusters.flatMap((c) => c.members.map((m) => m.body));
    const travel = flattened.filter((b) => /Osaka|大阪/.test(b));
    const pricing = flattened.filter((b) => /Opus 4\.7|pricing/.test(b));
    const heartbeat = flattened.filter((b) => /Heartbeat|23:00/.test(b));
    assert.equal(travel.length, 0, 'travel note is unique — must not join a cluster');
    assert.equal(pricing.length, 0, 'pricing note is unique');
    assert.equal(heartbeat.length, 0, 'heartbeat note is unique');
  });

  it('CJK 3-grams overlap on shared fragments', () => {
    const a = shingles('偏好本地优先的工具，记忆不要送到托管 API。');
    const b = shingles('偏好本地优先的工具。不要把记忆送到托管 API。');
    const sim = jaccard(a, b);
    assert.ok(sim > 0.4, `expected CJK overlap, got ${sim}`);
    const c = shingles('日本行程：先大阪，再京都，最后东京。');
    assert.ok(jaccard(a, c) < 0.2, 'unrelated CJK must stay far apart');
  });

  it('picks the most recently updated / longest representative', () => {
    const inv = inventory(dir);
    const { clusters } = findDuplicates(inv.items, { threshold: 0.45 });
    const hit = clusters.find((c) =>
      c.members.some((m) => /extraPaths|护栏|openclaw\.json/i.test(m.body)),
    );
    assert.ok(hit);
    // 2026-07-25 rewrite is the newest extraPaths variant
    assert.equal(hit.representative.updatedAt, '2026-07-25');
    assert.match(hit.representative.file, /2026-07-25/);
  });
});
