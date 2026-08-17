import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inventory, pruneMemory, planPrune } from '../src/index.js';
import { writeSyntheticMemory, rmrf } from './fixtures.js';

describe('prune safety', () => {
  let dir;
  let snapshots;
  beforeEach(() => {
    dir = writeSyntheticMemory();
    snapshots = snapshotTree(dir);
  });
  afterEach(() => { rmrf(dir); });

  it('dry-run does not mutate any user file', () => {
    const inv = inventory(dir);
    const result = pruneMemory({ dir, inv, apply: false });
    assert.equal(result.dryRun, true);
    assert.equal(result.filesTouched.length, 0);
    assert.equal(result.backups.length, 0);
    assert.deepEqual(snapshotTree(dir), snapshots);
    assert.equal(fs.existsSync(path.join(dir, 'memory-lens-report.md')), false);
  });

  it('--apply without confirmation aborts and writes nothing', () => {
    const inv = inventory(dir);
    const result = pruneMemory({ dir, inv, apply: true, confirm: false });
    assert.equal(result.aborted, true);
    assert.equal(result.filesTouched.length, 0);
    assert.deepEqual(snapshotTree(dir), snapshots);
  });

  it('--apply creates backups BEFORE editing, then writes an audit report', () => {
    const inv = inventory(dir);
    const plan = planPrune(inv.items);
    assert.ok(plan.removals.length >= 1, 'fixture must contain pruneable dupes');

    const result = pruneMemory({
      dir,
      inv,
      apply: true,
      confirm: true,
      stamp: '20260817-test',
    });
    assert.equal(result.dryRun, false);
    assert.equal(result.aborted, false);
    assert.ok(result.backups.length >= 1, 'backups must exist');
    for (const b of result.backups) {
      assert.ok(fs.existsSync(b.dest), `missing backup ${b.dest}`);
      // Backup equals the *original* bytes, not the edited file.
      const original = snapshots.get(path.join(dir, b.src));
      assert.equal(fs.readFileSync(b.dest, 'utf8'), original);
    }
    assert.ok(result.filesTouched.length >= 1);
    assert.ok(fs.existsSync(result.reportPath));
    const report = fs.readFileSync(result.reportPath, 'utf8');
    assert.match(report, /Memory Lens prune report/);
    assert.match(report, /Removals/);
    for (const r of result.removals) {
      assert.match(report, new RegExp(escapeRe(r.entry.provenance)));
    }
    // User files actually changed.
    let changed = 0;
    for (const rel of result.filesTouched) {
      const now = fs.readFileSync(path.join(dir, rel), 'utf8');
      if (now !== snapshots.get(path.join(dir, rel))) changed += 1;
    }
    assert.ok(changed >= 1);
  });
});

function snapshotTree(root) {
  const map = new Map();
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      if (name === '_memory-lens-backups' || name === 'memory-lens-report.md') continue;
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else map.set(full, fs.readFileSync(full, 'utf8'));
    }
  };
  walk(root);
  return map;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
