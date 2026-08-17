#!/usr/bin/env node
import { inventory, findDuplicates } from '../src/index.js';
import { writeSyntheticMemory, rmrf } from '../test/fixtures.js';

const n = Number(process.argv[2] || 400);
const dir = writeSyntheticMemory(undefined, { large: n });
try {
  const inv = inventory(dir);
  const r = findDuplicates(inv.items, { threshold: 0.55 });
  const line = [
    `entries=${inv.entries}`,
    `files=${inv.files}`,
    `clusters=${r.clusters.length}`,
    `pairs=${r.comparedPairs}`,
    `elapsedMs=${r.elapsedMs}`,
  ].join(' ');
  process.stdout.write(`${line}\n`);
} finally {
  rmrf(dir);
}
