import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.memory-lens-tmp',
  '_memory-lens-backups',
]);

/**
 * Recursively collect markdown files under `dir`.
 * Does not follow symlinks (a memory tool must not wander off-disk).
 */
export function walkMarkdown(dir) {
  const root = path.resolve(dir);
  const files = [];

  function visit(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.') continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(current, ent.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile() && /\.(md|markdown|txt)$/i.test(ent.name)) {
        files.push(full);
      }
    }
  }

  visit(root);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

export function relFrom(root, file) {
  return path.relative(path.resolve(root), file).split(path.sep).join('/');
}
