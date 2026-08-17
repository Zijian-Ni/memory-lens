import { inventory } from './inventory.js';
import { findDuplicates } from './dupes.js';
import { scoreDecay } from './decay.js';

/** JSON payload the static viewer understands. */
export function buildExport(dir, opts = {}) {
  const inv = inventory(dir);
  const dupes = findDuplicates(inv.items, { threshold: opts.threshold });
  const decay = scoreDecay(inv.items, { now: opts.now, dupThreshold: opts.threshold });
  return {
    schema: 'aurora.memory-lens.v1',
    generatedAt: new Date().toISOString(),
    dir,
    inventory: {
      files: inv.files,
      entries: inv.entries,
      tokens: inv.tokens,
      tokenMethod: inv.tokenMethod,
      dateRange: inv.dateRange,
      sections: inv.sections,
      fileStats: inv.fileStats,
    },
    entries: inv.items.map(slim),
    clusters: dupes.clusters.map((c) => ({
      size: c.size,
      representative: slim(c.representative),
      candidates: c.candidates.map(slim),
      scores: c.scores,
    })),
    decay: decay.review.map((r) => ({
      id: r.entry.id,
      provenance: r.entry.provenance,
      score: r.score,
      reasons: r.reasons,
      ageDays: r.ageDays,
      title: r.entry.title,
      body: r.entry.body,
      section: r.entry.section,
    })),
    timing: { dupesMs: dupes.elapsedMs, comparedPairs: dupes.comparedPairs },
  };
}

function slim(e) {
  return {
    id: e.id,
    file: e.file,
    line: e.line,
    endLine: e.endLine,
    provenance: e.provenance,
    kind: e.kind,
    headingPath: e.headingPath,
    section: e.section,
    title: e.title,
    body: e.body,
    tokens: e.tokens,
    updatedAt: e.updatedAt,
    citedDates: e.citedDates,
  };
}
