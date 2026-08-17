#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { inventory } from './inventory.js';
import { findDuplicates } from './dupes.js';
import { scoreDecay } from './decay.js';
import { pruneMemory, planPrune } from './prune.js';
import { buildExport } from './export.js';
import { t, detectLang } from './i18n.js';

const BOOL = new Set(['json', 'apply', 'yes', 'help', 'h']);

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.flags.help = true; continue; }
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (BOOL.has(k)) { out.flags[k] = true; continue; }
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out.flags[k] = true;
      else { out.flags[k] = next; i += 1; }
    } else out._.push(a);
  }
  return out;
}

function print(obj, asJson) {
  if (asJson) process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
  else process.stdout.write(obj);
}

function fmtInventory(inv, lang) {
  const lines = [];
  lines.push(`${t(lang, 'name')}`);
  lines.push(`${t(lang, 'files')}: ${inv.files}`);
  lines.push(`${t(lang, 'entries')}: ${inv.entries}`);
  lines.push(`${t(lang, 'tokens')}: ${inv.tokens}  (${t(lang, 'tokenMethod')})`);
  lines.push(`${t(lang, 'dateRange')}: ${inv.dateRange ? `${inv.dateRange.from} → ${inv.dateRange.to}` : '—'}`);
  lines.push('');
  lines.push(`${t(lang, 'sections')}:`);
  for (const s of inv.sections) {
    lines.push(`  ${s.entries.toString().padStart(4)}  ${s.tokens.toString().padStart(6)} tok   ${s.section}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function fmtDupes(dupes, lang) {
  const lines = [];
  lines.push(`${t(lang, 'clusters')}: ${dupes.clusters.length}`);
  lines.push(`${t(lang, 'elapsed')}: ${dupes.elapsedMs} ms  (pairs compared: ${dupes.comparedPairs})`);
  lines.push('');
  if (!dupes.clusters.length) {
    lines.push(t(lang, 'noClusters'));
    return `${lines.join('\n')}\n`;
  }
  let n = 1;
  for (const c of dupes.clusters) {
    lines.push(`#${n++}  size=${c.size}`);
    lines.push(`  ${t(lang, 'representative')}: ${c.representative.provenance}`);
    lines.push(`    ${oneLine(c.representative.body)}`);
    for (const cand of c.candidates) {
      lines.push(`  ${t(lang, 'candidates')}: ${cand.provenance}  jaccard=${c.scores[cand.id]}`);
      lines.push(`    ${oneLine(cand.body)}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function fmtDecay(decay, lang) {
  const lines = [];
  lines.push(`${t(lang, 'review')}`);
  lines.push('');
  if (!decay.review.length) {
    lines.push(t(lang, 'noDecay'));
    return `${lines.join('\n')}\n`;
  }
  lines.push('score  provenance                   reasons');
  for (const r of decay.review.slice(0, 50)) {
    const why = r.reasons.map((x) => `${t(lang, x.code)}:${x.detail}`).join('; ');
    lines.push(`${String(r.score).padStart(5)}  ${r.entry.provenance.padEnd(28)}  ${why}`);
  }
  if (decay.review.length > 50) lines.push(`… ${decay.review.length - 50} more`);
  lines.push('');
  lines.push(t(lang, 'limitations'));
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function oneLine(s) {
  return String(s).replace(/\s+/g, ' ').slice(0, 100);
}

function askPrune(n) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(t(detectLang(), 'applyNeedConfirm', { n }), (answer) => {
      rl.close();
      resolve(String(answer).trim().toLowerCase() === 'prune');
    });
  });
}

async function main(argv = process.argv.slice(2)) {
  const { _, flags } = parseArgs(argv);
  const lang = detectLang(flags.lang, process.env);
  const cmd = _[0];
  const dir = _[1];

  if (flags.help || !cmd || cmd === 'help') {
    print(`${t(lang, 'usage')}\n`, false);
    return 0;
  }

  if (!dir) {
    process.stderr.write(`missing <dir>\n\n${t(lang, 'usage')}\n`);
    return 2;
  }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    process.stderr.write(`not a directory: ${dir}\n`);
    return 2;
  }

  const threshold = flags.threshold != null ? Number(flags.threshold) : undefined;

  if (cmd === 'inventory') {
    const inv = inventory(dir);
    if (flags.json) print({ files: inv.files, entries: inv.entries, tokens: inv.tokens, tokenMethod: inv.tokenMethod, dateRange: inv.dateRange, sections: inv.sections }, true);
    else print(fmtInventory(inv, lang), false);
    return 0;
  }

  if (cmd === 'dupes') {
    const inv = inventory(dir);
    const dupes = findDuplicates(inv.items, { threshold });
    if (flags.json) {
      print({
        clusters: dupes.clusters.map((c) => ({
          size: c.size,
          representative: c.representative.provenance,
          candidates: c.candidates.map((x) => x.provenance),
          scores: c.scores,
        })),
        elapsedMs: dupes.elapsedMs,
        comparedPairs: dupes.comparedPairs,
        threshold: dupes.threshold,
      }, true);
    } else print(fmtDupes(dupes, lang), false);
    return 0;
  }

  if (cmd === 'decay') {
    const inv = inventory(dir);
    const decay = scoreDecay(inv.items, { dupThreshold: threshold });
    if (flags.json) {
      print({
        review: decay.review.map((r) => ({
          provenance: r.entry.provenance,
          score: r.score,
          reasons: r.reasons,
          ageDays: r.ageDays,
        })),
        generatedAt: decay.generatedAt,
      }, true);
    } else print(fmtDecay(decay, lang), false);
    return 0;
  }

  if (cmd === 'export') {
    const payload = buildExport(dir, { threshold });
    const out = flags.out || path.join(process.cwd(), 'memory-lens.json');
    fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
    process.stderr.write(`wrote ${out}\n`);
    return 0;
  }

  if (cmd === 'prune') {
    const inv = inventory(dir);
    const plan = planPrune(inv.items, { threshold });
    if (!flags.apply) {
      if (flags.json) {
        print({ dryRun: true, wouldRemove: plan.removals.map((r) => r.entry.provenance), files: [...plan.byFile.keys()] }, true);
      } else {
        print(`${t(lang, 'dryRun')}\n${t(lang, 'candidates')}: ${plan.removals.length}\n`, false);
        for (const r of plan.removals) {
          print(`  ${r.entry.provenance}  → keep ${r.keep.provenance}  j=${r.score}\n`, false);
        }
      }
      return 0;
    }

    let confirm = !!flags.yes;
    if (!confirm) {
      if (!process.stdin.isTTY) {
        process.stderr.write(`${t(lang, 'needTty')}\n`);
        return 2;
      }
      confirm = await askPrune(plan.byFile.size);
    }
    if (!confirm) {
      process.stderr.write(`${t(lang, 'aborted')}\n`);
      return 1;
    }

    const result = pruneMemory({ dir, inv, apply: true, confirm: true, threshold });
    if (flags.json) {
      print({
        dryRun: false,
        backups: result.backups,
        filesTouched: result.filesTouched,
        removed: result.removals.map((r) => r.entry.provenance),
        reportPath: result.reportPath,
      }, true);
    } else {
      print(`${t(lang, 'backedUp')}: ${result.backups.length}\n`, false);
      print(`${t(lang, 'removed')}: ${result.removals.length}\n`, false);
      print(`${t(lang, 'reportWritten')}: ${result.reportPath}\n`, false);
    }
    return 0;
  }

  process.stderr.write(`unknown command: ${cmd}\n\n${t(lang, 'usage')}\n`);
  return 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().then((code) => process.exit(code ?? 0), (err) => {
    process.stderr.write(`${err?.stack || err}\n`);
    process.exit(1);
  });
}

export { main, parseArgs };
