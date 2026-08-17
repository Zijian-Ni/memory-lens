import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSyntheticMemory, rmrf } from './fixtures.js';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    timeout: 20_000,
    ...opts,
  });
}

describe('CLI', () => {
  let dir;
  before(() => { dir = writeSyntheticMemory(); });
  after(() => { rmrf(dir); });

  it('inventory --json reports counts', () => {
    const r = run(['inventory', dir, '--json']);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.ok(j.files >= 5);
    assert.ok(j.entries >= 10);
    assert.ok(j.tokenMethod);
  });

  it('dupes --json returns clusters and a wall-time', () => {
    const r = run(['dupes', dir, '--json']);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.ok(Array.isArray(j.clusters));
    assert.equal(typeof j.elapsedMs, 'number');
  });

  it('decay --json is a review list', () => {
    const r = run(['decay', dir, '--json']);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.ok(Array.isArray(j.review));
    assert.equal(j.delete, undefined);
  });

  it('prune without --apply is dry-run and does not write a report', () => {
    const r = run(['prune', dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Dry-run|演练/);
    assert.equal(fs.existsSync(path.join(dir, 'memory-lens-report.md')), false);
  });

  it('prune --apply without TTY / --yes refuses to mutate', () => {
    const before = fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8');
    const r = run(['prune', dir, '--apply'], { stdio: ['pipe', 'pipe', 'pipe'] });
    assert.notEqual(r.status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8'), before);
  });

  it('prints bilingual help', () => {
    const en = run(['help', '--lang', 'en']);
    const zh = run(['help', '--lang', 'zh']);
    assert.match(en.stdout, /inventory/);
    assert.match(zh.stdout, /检视|用法/);
  });
});
