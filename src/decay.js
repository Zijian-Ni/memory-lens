import { findDuplicates, shingles, jaccard } from './dupes.js';

/**
 * Decay scoring — ranks entries a human should re-read.
 *
 * This is a heuristic, not a reasoner. Signals we can actually justify:
 *   1. Age (days since file date / mtime). Older → staler.
 *   2. A *later* entry lexically contradicts it (negation flip or number clash).
 *   3. It is a near-duplicate of a newer entry.
 *   4. It cites an ISO date that is now in the past (and is not "that was the day").
 *
 * Output is a REVIEW list. Never a delete list.
 */

const NEG_EN = /\b(not|no|never|none|without|isn'?t|aren'?t|wasn'?t|weren'?t|doesn'?t|don'?t|didn'?t|won'?t|can'?t|cannot|couldn'?t|shouldn'?t|fail(?:ed|s|ing)?|unable|missing|absent|lack(?:s|ing|ed)?)\b/i;
const NEG_ZH = /(不|没|没有|未|无法|无(?!线)|非|并非|失败|缺少|缺失|尚未|从未|不能|不会|不是)/;
const NEG_EXCEPTIONS = /\b(not only|no doubt|no less|nothing but|failsafe|fail-safe)\b|不仅|不但|无疑|不外乎/i;

const NUMBER_RE = /([-+]?\d+(?:\.\d+)?)(%|％|ms|s|x|×|倍|k|kb|mb|gb|tb)?/gi;

export function negationPolarity(sentence) {
  const s = String(sentence ?? '');
  if (!s.trim()) return 1;
  if (NEG_EXCEPTIONS.test(s)) return 1;
  const hits = (s.match(new RegExp(NEG_EN, 'gi')) || []).length
    + (s.match(new RegExp(NEG_ZH, 'g')) || []).length;
  return hits > 0 && hits % 2 === 1 ? -1 : 1;
}

function extractNumbers(text) {
  const out = [];
  const re = new RegExp(NUMBER_RE.source, 'gi');
  let m;
  while ((m = re.exec(text))) {
    out.push({ value: Number(m[1]), unit: (m[2] || '').toLowerCase() });
  }
  return out;
}

function numberConflict(a, b) {
  const na = extractNumbers(a);
  const nb = extractNumbers(b);
  if (!na.length || !nb.length) return false;
  for (const x of na) {
    for (const y of nb) {
      if (x.unit !== y.unit) continue;
      if (Number.isNaN(x.value) || Number.isNaN(y.value)) continue;
      if (x.value !== y.value) return true;
    }
  }
  return false;
}

function lexicalOverlap(a, b) {
  return jaccard(shingles(a), shingles(b));
}

function parseDay(iso) {
  if (!iso) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

function daysBetween(laterMs, earlierMs) {
  return Math.max(0, Math.round((laterMs - earlierMs) / 86_400_000));
}

function entryTime(e) {
  const d = parseDay(e.updatedAt) || parseDay(e.fileDate);
  if (d != null) return d;
  return e.mtimeMs || 0;
}

export function detectContradiction(older, newer) {
  const reasons = [];
  const overlap = lexicalOverlap(older.body, newer.body);
  if (overlap < 0.18) return reasons;
  const pOld = negationPolarity(older.body);
  const pNew = negationPolarity(newer.body);
  if (pOld !== pNew) reasons.push('negation');
  if (numberConflict(older.body, newer.body)) reasons.push('number');
  return reasons;
}

export function scoreDecay(entries, opts = {}) {
  const now = opts.now ? Date.parse(opts.now) : Date.now();
  const { clusters } = findDuplicates(entries, { threshold: opts.dupThreshold ?? 0.55 });
  const newerDupOf = new Map();
  for (const c of clusters) {
    const keep = c.representative;
    for (const other of c.candidates) {
      if (entryTime(other) <= entryTime(keep)) {
        newerDupOf.set(other.id, keep);
      }
    }
  }

  const ranked = entries.map((e) => {
    const reasons = [];
    let score = 0;
    const ageDays = daysBetween(now, entryTime(e) || now);
    if (ageDays >= 30) {
      const ageScore = Math.min(40, Math.floor(ageDays / 7));
      score += ageScore;
      reasons.push({ code: 'age', detail: `${ageDays}d` });
    }

    if (newerDupOf.has(e.id)) {
      score += 35;
      reasons.push({ code: 'duplicateOf', detail: newerDupOf.get(e.id).provenance });
    }

    const later = entries.filter((o) => o.id !== e.id && entryTime(o) > entryTime(e));
    let contra = null;
    for (const o of later) {
      const hits = detectContradiction(e, o);
      if (hits.length) {
        contra = { other: o, hits };
        break;
      }
    }
    if (contra) {
      score += 40;
      reasons.push({
        code: 'contradicted',
        detail: `${contra.other.provenance} (${contra.hits.join('+')})`,
      });
    }

    const today = new Date(now).toISOString().slice(0, 10);
    const past = (e.citedDates || []).filter((d) => d < today);
    if (past.length) {
      score += Math.min(20, past.length * 8);
      reasons.push({ code: 'pastDate', detail: past.join(', ') });
    }

    return { entry: e, score, reasons, ageDays };
  });

  ranked.sort((a, b) => b.score - a.score || a.entry.provenance.localeCompare(b.entry.provenance));
  return {
    review: ranked.filter((r) => r.score > 0),
    all: ranked,
    generatedAt: new Date(now).toISOString(),
  };
}
