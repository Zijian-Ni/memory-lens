/**
 * Near-duplicate detection with no embeddings and no network.
 *
 * Character 3-grams (not word tokens) are the right unit for mixed CN/EN
 * memory files: CJK has no whitespace, so a word-shingle pipeline would
 * collapse every Chinese sentence into one giant token and miss paraphrases
 * that share a 三字片段. Latin text still produces useful overlapping
 * trigrams ("the agent" → "the","he ","e a",…). Jaccard on those sets is
 * lexical, not semantic — "prefer Opus" and "use the expensive model"
 * will not match, and the README says so.
 *
 * MinHash + LSH banding is a cheap prefilter so we never do a full
 * O(n²) Jaccard sweep on 10k entries. Candidates that share a band
 * are then compared exactly.
 */

const SHINGLE_N = 3;
const HASH_COUNT = 64;
const BANDS = 16; // 16 bands × 4 rows. Tuned for Jaccard ≳ 0.5.
const ROWS = HASH_COUNT / BANDS;
const DEFAULT_THRESHOLD = 0.55;

export const DUPES_DEFAULTS = { shingleN: SHINGLE_N, hashCount: HASH_COUNT, bands: BANDS, threshold: DEFAULT_THRESHOLD };

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mix(h, seed) {
  // SplitMix32 — deterministic, no BigInt needed.
  let z = (h ^ (seed * 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

export function normalizeForShingle(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[`*_>#|~\-\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shingles(text, n = SHINGLE_N) {
  const s = normalizeForShingle(text);
  const set = new Set();
  if (s.length === 0) return set;
  if (s.length < n) {
    set.add(s);
    return set;
  }
  for (let i = 0; i <= s.length - n; i++) set.add(s.slice(i, i + n));
  return set;
}

export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function minhash(set, hashCount = HASH_COUNT) {
  const sig = new Array(hashCount).fill(0xffffffff);
  if (set.size === 0) return sig.map((_, i) => mix(i, i + 1));
  for (const gram of set) {
    const base = fnv1a(gram);
    for (let i = 0; i < hashCount; i++) {
      const h = mix(base, i + 1);
      if (h < sig[i]) sig[i] = h;
    }
  }
  return sig;
}

export function bandKeys(sig, bands = BANDS, rows = ROWS) {
  const keys = [];
  for (let b = 0; b < bands; b++) {
    let k = `${b}:`;
    const off = b * rows;
    for (let r = 0; r < rows; r++) k += (sig[off + r] >>> 0).toString(16) + ',';
    keys.push(k);
  }
  return keys;
}

function unionFind(n) {
  const p = Array.from({ length: n }, (_, i) => i);
  const r = new Array(n).fill(0);
  const find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a === b) return;
    if (r[a] < r[b]) [a, b] = [b, a];
    p[b] = a;
    if (r[a] === r[b]) r[a] += 1;
  };
  return { find, unite };
}

function pickRepresentative(members) {
  return [...members].sort((a, b) => {
    const dateA = a.updatedAt || '';
    const dateB = b.updatedAt || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    if (b.body.length !== a.body.length) return b.body.length - a.body.length;
    return a.provenance.localeCompare(b.provenance);
  })[0];
}

/**
 * Group near-duplicate entries. Returns clusters + wall-clock ms.
 */
export function findDuplicates(entries, opts = {}) {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const started = performance.now();
  const usable = entries.map((e, i) => ({ e, i, set: shingles(e.body || e.text || '') }));
  const buckets = new Map();
  const sigs = usable.map((u) => minhash(u.set));

  for (let i = 0; i < usable.length; i++) {
    for (const key of bandKeys(sigs[i])) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  }

  const uf = unionFind(usable.length);
  const seenPair = new Set();
  for (const ids of buckets.values()) {
    if (ids.length < 2) continue;
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const i = ids[a];
        const j = ids[b];
        const pair = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seenPair.has(pair)) continue;
        seenPair.add(pair);
        const sim = jaccard(usable[i].set, usable[j].set);
        if (sim >= threshold) uf.unite(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < usable.length; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(usable[i]);
  }

  const clusters = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const items = members.map((m) => m.e);
    const representative = pickRepresentative(items);
    const others = items.filter((e) => e.id !== representative.id);
    const scores = {};
    for (const m of members) {
      const r = members.find((x) => x.e.id === representative.id);
      scores[m.e.id] = Number(jaccard(m.set, r.set).toFixed(3));
    }
    clusters.push({
      size: items.length,
      representative,
      candidates: others,
      members: items,
      scores,
    });
  }

  clusters.sort((a, b) => b.size - a.size || b.representative.body.length - a.representative.body.length);
  const elapsedMs = Math.round(performance.now() - started);
  return { clusters, elapsedMs, comparedPairs: seenPair.size, threshold };
}

export { DEFAULT_THRESHOLD, SHINGLE_N };
