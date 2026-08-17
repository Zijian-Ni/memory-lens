import fs from 'node:fs';
import path from 'node:path';
import { findDuplicates } from './dupes.js';

/**
 * The ONLY mutating command.
 *
 * Default is dry-run. `--apply` plus interactive confirmation (or `confirm: true`
 * for tests / `--yes`) is required. Every touched file is copied to a
 * timestamped backup *before* any edit. A `memory-lens-report.md` records
 * exactly what was removed and from where.
 *
 * We never invent a delete list from decay. Prune only removes entries that
 * appear as *candidates* in a duplicate cluster (the representative stays).
 */

export function planPrune(entries, opts = {}) {
  const { clusters } = findDuplicates(entries, { threshold: opts.threshold });
  const removals = [];
  for (const c of clusters) {
    for (const cand of c.candidates) {
      removals.push({
        entry: cand,
        keep: c.representative,
        score: c.scores[cand.id],
      });
    }
  }
  const byFile = new Map();
  for (const r of removals) {
    if (!byFile.has(r.entry.file)) byFile.set(r.entry.file, []);
    byFile.get(r.entry.file).push(r);
  }
  return { clusters, removals, byFile };
}

export function applyRemovalsToText(text, removals) {
  const lines = String(text).split(/\r?\n/);
  const ranges = removals
    .map((r) => ({ start: r.entry.line, end: r.entry.endLine }))
    .sort((a, b) => b.start - a.start);
  for (const { start, end } of ranges) {
    const from = Math.max(0, start - 1);
    const to = Math.max(from, end);
    lines.splice(from, to - from);
  }
  let out = lines.join('\n');
  if (text.endsWith('\n') && !out.endsWith('\n')) out += '\n';
  return out;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function backupPathFor(file, stampStr, backupDir) {
  const base = path.basename(file);
  return path.join(backupDir, `${base}.${stampStr}.bak`);
}

export function writeBackup(file, backupDir, stampStr) {
  fs.mkdirSync(backupDir, { recursive: true });
  const dest = backupPathFor(file, stampStr, backupDir);
  fs.copyFileSync(file, dest);
  return dest;
}

function renderReport({ dir, stampStr, backups, removals, dryRun }) {
  const lines = [
    `# Memory Lens prune report`,
    ``,
    `- when: ${new Date().toISOString()}`,
    `- stamp: ${stampStr}`,
    `- directory: \`${dir}\``,
    `- mode: ${dryRun ? 'dry-run' : 'apply'}`,
    `- removed entries: ${removals.length}`,
    ``,
    `## Backups`,
    ``,
  ];
  if (!backups.length) lines.push(dryRun ? `_Dry-run — no backups written._` : `_No files touched._`);
  else for (const b of backups) lines.push(`- \`${b.src}\` → \`${b.dest}\``);
  lines.push('', '## Removals', '');
  if (!removals.length) lines.push('_Nothing to remove._');
  else {
    lines.push('| Provenance | Kept instead | Jaccard | Preview |', '|---|---|---:|---|');
    for (const r of removals) {
      const preview = r.entry.body.replace(/\s+/g, ' ').slice(0, 80).replace(/\|/g, '\\|');
      lines.push(`| \`${r.entry.provenance}\` | \`${r.keep.provenance}\` | ${r.score ?? ''} | ${preview} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {object} args
 * @param {string} args.dir
 * @param {object} args.inv  inventory() result
 * @param {boolean} [args.apply]
 * @param {boolean} [args.confirm]  already confirmed (tests / --yes)
 * @param {() => boolean} [args.ask]  interactive prompt
 * @param {string} [args.backupDir]
 * @param {string} [args.reportPath]
 */
export function pruneMemory(args) {
  const dir = path.resolve(args.dir);
  const apply = !!args.apply;
  const plan = planPrune(args.inv.items, { threshold: args.threshold });
  const stampStr = args.stamp || stamp();
  const backupDir = args.backupDir || path.join(dir, '_memory-lens-backups', stampStr);
  const reportPath = args.reportPath || path.join(dir, 'memory-lens-report.md');

  const result = {
    dryRun: !apply,
    stamp: stampStr,
    backupDir,
    reportPath,
    removals: plan.removals,
    backups: [],
    filesTouched: [],
    aborted: false,
    report: null,
  };

  if (!apply) {
    result.report = renderReport({ dir, stampStr, backups: [], removals: plan.removals, dryRun: true });
    return result;
  }

  if (plan.removals.length === 0) {
    result.report = renderReport({ dir, stampStr, backups: [], removals: [], dryRun: false });
    fs.writeFileSync(reportPath, result.report);
    return result;
  }

  const ok = args.confirm === true || (typeof args.ask === 'function' && args.ask(plan));
  if (!ok) {
    result.aborted = true;
    result.report = renderReport({ dir, stampStr, backups: [], removals: plan.removals, dryRun: true });
    return result;
  }

  const files = [...plan.byFile.keys()];
  const abs = (rel) => path.join(dir, rel);

  // Backups FIRST — if any backup fails we stop before touching user data.
  for (const rel of files) {
    const src = abs(rel);
    const dest = writeBackup(src, backupDir, stampStr);
    result.backups.push({ src: rel, dest });
  }

  for (const rel of files) {
    const src = abs(rel);
    const original = fs.readFileSync(src, 'utf8');
    const next = applyRemovalsToText(original, plan.byFile.get(rel));
    fs.writeFileSync(src, next);
    result.filesTouched.push(rel);
  }

  result.report = renderReport({ dir, stampStr, backups: result.backups, removals: plan.removals, dryRun: false });
  fs.writeFileSync(reportPath, result.report);
  return result;
}
